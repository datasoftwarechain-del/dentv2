/**
 * [035_design_studio] Archivos de una orden de diseño.
 *
 * Es la primera integración real con Supabase Storage del sistema. Tres
 * reglas que la separan del intento anterior en "Casos Digitales":
 *
 *   1. El bucket es PRIVADO. No existe getPublicUrl() acá: todo se sirve
 *      con URL firmada de 300 s. Un escaneo intraoral es dato clínico.
 *   2. La ruta la arma el servidor (buildStoragePath), no el cliente. El
 *      primer segmento es el UUID de la orden, que es sobre lo que la
 *      policy de storage.objects resuelve el permiso.
 *   3. Nada falla en silencio. Si la subida no se puede registrar, la
 *      respuesta lo dice; no se sigue de largo dejando el archivo perdido.
 *
 * Flujo de subida en dos pasos: POST pide la URL firmada, el navegador
 * sube contra ella, y PATCH confirma y recién ahí se registra la fila.
 * Así una subida cortada a la mitad no deja una fila apuntando a la nada.
 */

import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { resolveDesignAccess, requireDesignPermission } from "@/lib/design/access";
import { canClientDownload } from "@/lib/design/status";
import {
  DESIGN_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  buildStoragePath,
  validateDesignFile,
  UPLOADER_SIDE,
} from "@/lib/design/files";
import type { DesignFileKind } from "@/lib/design/types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const KINDS = ["input_scan", "input_reference", "output_design", "output_preview", "annotation"] as const;

const RequestUploadSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().positive(),
  kind: z.enum(KINDS),
});

const ConfirmUploadSchema = z.object({
  storage_path: z.string().min(1).max(1024),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().positive(),
  kind: z.enum(KINDS),
  version: z.number().int().positive(),
  mime_type: z.string().max(255).nullish(),
  checksum: z.string().max(128).nullish(),
});

/** ¿Puede este lado subir esta clase de archivo? */
function canUpload(kind: DesignFileKind, side: "client" | "studio"): boolean {
  const allowed = UPLOADER_SIDE[kind];
  return allowed === "both" || allowed === side;
}

/** Permiso fino que exige subir cada clase de archivo. */
function uploadPermissionFor(kind: DesignFileKind, side: "client" | "studio") {
  if (side === "studio") return "upload_design_output" as const;
  return "create_design_orders" as const;
}

/**
 * Estados en los que el cliente todavía puede cambiar el caso.
 *
 * Con el diseño en curso, un escaneo nuevo cambia el trabajo por debajo
 * del diseñador sin que nadie lo sepa. El canal para eso es "Faltan
 * datos" (lo pide el estudio) o "Pedir cambios" (lo pide el cliente):
 * los dos dejan rastro en la bitácora. Las referencias y anotaciones
 * sí se aceptan siempre, porque no redefinen el caso.
 */
const CLIENT_SCAN_WINDOW = ["draft", "needs_info", "awaiting_payment"];

// ════════════════════════════════════════════════════════════
/** GET — lista los archivos con URL firmada para los que se puedan bajar. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { access, error: accessError } = await resolveDesignAccess(id);
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: accessError.status });
    }

    const { side, order, paymentMode } = access;
    const supabase = await createClient();

    const { data: files, error } = await supabase
      .from("design_order_files")
      .select("*")
      .eq("design_order_id", id)
      .order("kind")
      .order("version", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // La segunda compuerta del modo prepago: sin factura paga el STL no sale.
    let invoicePaid = false;
    if (paymentMode === "prepaid" && order.invoice_id) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("status")
        .eq("id", order.invoice_id)
        .maybeSingle();
      invoicePaid = invoice?.status === "paid";
    }

    // La primera vez que el cliente puede bajarse el STL final, la orden
    // está entregada de hecho. Marcarlo acá en vez de esperar un clic del
    // estudio hace que `delivered_at` — y la métrica "aprobación →
    // entrega" — refleje lo que pasó y no lo que alguien recordó anotar.
    // Es idempotente: el estado solo cambia una vez.
    let markDelivered = false;

    const rows = await Promise.all(
      (files ?? []).map(async (file: any) => {
        // El estudio siempre puede bajar lo suyo. El cliente pasa por las
        // compuertas: liberado, y pago si el acuerdo es prepago.
        const allowed =
          side === "studio" ||
          file.kind !== "output_design" ||
          canClientDownload({ isReleased: file.is_released, paymentMode, invoicePaid });

        if (!allowed) {
          return { ...file, download_url: null, locked: true };
        }

        const { data: signed } = await supabase.storage
          .from(DESIGN_BUCKET)
          .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);

        if (signed?.signedUrl && side === "client"
            && file.kind === "output_design" && order.status === "approved") {
          markDelivered = true;
        }

        return { ...file, download_url: signed?.signedUrl ?? null, locked: false };
      }),
    );

    if (markDelivered) {
      await supabase.from("design_orders")
        .update({ status: "delivered" })
        .eq("id", id)
        .eq("status", "approved");
      await supabase.from("design_order_events").insert({
        design_order_id: id,
        type: "status_change",
        actor_side: "client",
        actor_id: access.userId,
        from_status: "approved",
        to_status: "delivered",
        message: "El cliente accedió al diseño final.",
      });
    }

    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════
/** POST — pide una URL firmada para subir. No registra nada todavía. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { access, error: accessError } = await resolveDesignAccess(id);
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: accessError.status });
    }

    const { data: body, error: bodyError } = await validateBody(request, RequestUploadSchema);
    if (bodyError) return bodyError;

    const { side, order } = access;

    if (!canUpload(body.kind, side)) {
      return NextResponse.json(
        { error: "No podés subir ese tipo de archivo en esta orden." },
        { status: 403 },
      );
    }

    const denied = requireDesignPermission(access, uploadPermissionFor(body.kind, side));
    if (denied) {
      return NextResponse.json({ error: denied.message }, { status: denied.status });
    }

    if (side === "client" && body.kind === "input_scan"
        && !CLIENT_SCAN_WINDOW.includes(order.status)) {
      return NextResponse.json(
        {
          error:
            "El diseño ya está en curso. Si el escaneo cambió, pedí cambios desde la orden " +
            "para que el diseñador lo sepa.",
        },
        { status: 409 },
      );
    }

    // Una orden cerrada no recibe más archivos.
    if (order.status === "delivered" || order.status === "cancelled") {
      return NextResponse.json(
        { error: "La orden ya está cerrada: no admite archivos nuevos." },
        { status: 409 },
      );
    }

    const check = validateDesignFile(body.file_name, body.file_size, body.kind);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 422 });
    }

    const supabase = await createClient();

    // Versión: la siguiente dentro de la misma clase. Así el diseño v2
    // convive con el v1 y el cliente puede comparar qué cambió.
    const { data: last } = await supabase
      .from("design_order_files")
      .select("version")
      .eq("design_order_id", id)
      .eq("kind", body.kind)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (last?.version ?? 0) + 1;
    const storagePath = buildStoragePath(id, body.kind, version, body.file_name);

    const { data: signed, error: signError } = await supabase.storage
      .from(DESIGN_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signError || !signed) {
      return NextResponse.json(
        { error: signError?.message ?? "No se pudo preparar la subida" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        storage_path: storagePath,
        version,
        token: signed.token,
        signed_url: signed.signedUrl,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════
/** PATCH — confirma una subida terminada y registra la fila. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { access, error: accessError } = await resolveDesignAccess(id);
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: accessError.status });
    }

    const { data: body, error: bodyError } = await validateBody(request, ConfirmUploadSchema);
    if (bodyError) return bodyError;

    const { side, userId } = access;

    if (!canUpload(body.kind, side)) {
      return NextResponse.json({ error: "No autorizado para este archivo." }, { status: 403 });
    }

    const denied = requireDesignPermission(access, uploadPermissionFor(body.kind, side));
    if (denied) {
      return NextResponse.json({ error: denied.message }, { status: denied.status });
    }

    // La ruta tiene que ser exactamente la que firmamos. Si no coincide,
    // alguien está intentando registrar un objeto de otra orden.
    const expected = buildStoragePath(id, body.kind, body.version, body.file_name);
    if (body.storage_path !== expected) {
      return NextResponse.json({ error: "Ruta de archivo inválida." }, { status: 400 });
    }

    const supabase = await createClient();

    // Verificamos contra el bucket que el objeto exista de verdad antes
    // de crear la fila. Es lo que evita el fantasma de "Casos Digitales":
    // una referencia en la base sin archivo detrás.
    const folder = `${id}/${body.kind}`;
    const { data: listed } = await supabase.storage
      .from(DESIGN_BUCKET)
      .list(folder, { search: `${body.version}-` });

    const fileNameInBucket = body.storage_path.slice(folder.length + 1);
    const exists = (listed ?? []).some((o) => o.name === fileNameInBucket);

    if (!exists) {
      return NextResponse.json(
        { error: "El archivo no llegó al almacenamiento. Reintentá la subida." },
        { status: 409 },
      );
    }

    // La previsualización se libera al subirse: es lo que el cliente mira
    // para decidir. El STL se libera recién al aprobar.
    const isReleased = body.kind !== "output_design";

    const { data: row, error: insertError } = await supabase
      .from("design_order_files")
      .insert({
        design_order_id: id,
        kind: body.kind,
        version: body.version,
        file_name: body.file_name,
        storage_path: body.storage_path,
        mime_type: body.mime_type ?? null,
        file_size: body.file_size,
        checksum: body.checksum ?? null,
        is_released: isReleased,
        uploaded_by: userId,
      })
      .select("*")
      .single();

    if (insertError || !row) {
      return NextResponse.json(
        { error: insertError?.message ?? "No se pudo registrar el archivo" },
        { status: 500 },
      );
    }

    await supabase.from("design_order_events").insert({
      design_order_id: id,
      type: "file_upload",
      actor_side: side,
      actor_id: userId,
      message: `${body.file_name} (v${body.version})`,
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
