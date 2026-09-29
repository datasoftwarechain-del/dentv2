/**
 * [043] Subida del diseño terminado desde el portal del diseñador.
 *
 * Mismo flujo de dos pasos que usa el estudio en
 * /api/design/orders/[id]/files, y a propósito: el archivo va al MISMO
 * bucket, con la MISMA ruta y las MISMAS validaciones. Que el que sube no
 * tenga cuenta no le afloja ninguna regla.
 *
 *   POST  → pide la URL firmada de subida
 *   PATCH → confirma que el objeto existe y recién ahí registra la fila
 *
 * Así una subida cortada a la mitad no deja una fila apuntando a la nada.
 *
 * El archivo entra con `is_released = false`: el entregable se libera recién
 * cuando el cliente APRUEBA. Lo que sí decide esta ruta es a dónde va la
 * orden (control interno o revisión del cliente) y si sale el aviso, y eso
 * lo resuelve publicarDiseno() según el interruptor del estudio.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { resolverToken, MENSAJE_RECHAZO } from "@/lib/design/dispatch/resolve";
import { DESIGN_BUCKET, buildStoragePath, validateDesignFile } from "@/lib/design/files";
import { publicarDiseno } from "@/lib/design/dispatch/publish";

const KIND = "output_design" as const;

const PedirSubidaSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().positive(),
});

const ConfirmarSchema = z.object({
  storage_path: z.string().min(1).max(1024),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().positive(),
  version: z.number().int().positive(),
  mime_type: z.string().max(255).nullish(),
  checksum: z.string().max(128).nullish(),
});

/** El portal solo sirve con el caso ya aceptado: subir es trabajo hecho. */
async function exigirAceptado(token: string) {
  const resolucion = await resolverToken(token);
  if (!resolucion.ok) {
    return { error: NextResponse.json({ error: MENSAJE_RECHAZO[resolucion.motivo] }, { status: 403 }) } as const;
  }
  if (resolucion.data.dispatch.status !== "accepted") {
    return {
      error: NextResponse.json({ error: "Primero tenés que aceptar el caso." }, { status: 409 }),
    } as const;
  }
  return { data: resolucion.data } as const;
}

export async function POST(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { token } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, PedirSubidaSchema);
  if (bodyError) return bodyError;

  const resuelto = await exigirAceptado(token);
  if ("error" in resuelto) return resuelto.error;

  const { order } = resuelto.data;

  const validacion = validateDesignFile(body.file_name, body.file_size, KIND);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: ultima } = await admin
    .from("design_order_files")
    .select("version")
    .eq("design_order_id", order.id)
    .eq("kind", KIND)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (ultima?.version ?? 0) + 1;
  const storagePath = buildStoragePath(order.id, KIND, version, body.file_name);

  const { data: signed, error: signError } = await admin.storage
    .from(DESIGN_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    logger.error("[entrega] no se pudo firmar la subida:", signError?.message);
    return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      storage_path: storagePath,
      version,
      signed_url: signed.signedUrl,
    },
  });
}

export async function PATCH(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { token } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, ConfirmarSchema);
  if (bodyError) return bodyError;

  const resuelto = await exigirAceptado(token);
  if ("error" in resuelto) return resuelto.error;

  const { order, dispatch, designer } = resuelto.data;

  // La ruta la recalcula el servidor: si no coincide con la que manda el
  // cliente, alguien está intentando registrar un objeto que no subió acá.
  const esperada = buildStoragePath(order.id, KIND, body.version, body.file_name);
  if (esperada !== body.storage_path) {
    return NextResponse.json({ error: "La ruta del archivo no coincide." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Que el objeto exista de verdad antes de registrar la fila.
  const { data: encontrados } = await admin.storage
    .from(DESIGN_BUCKET)
    .list(`${order.id}/${KIND}`, { search: esperada.split("/").pop() });

  if (!encontrados || encontrados.length === 0) {
    return NextResponse.json(
      { error: "El archivo no llegó al almacenamiento. Probá subirlo de nuevo." },
      { status: 409 },
    );
  }

  const { error: insertError } = await admin.from("design_order_files").insert({
    design_order_id: order.id,
    kind: KIND,
    version: body.version,
    file_name: body.file_name,
    storage_path: body.storage_path,
    mime_type: body.mime_type ?? null,
    file_size: body.file_size,
    checksum: body.checksum ?? null,
    is_released: false,
  });

  if (insertError) {
    logger.error("[entrega] no se pudo registrar el archivo:", insertError.message);
    return NextResponse.json({ error: "El archivo subió pero no se pudo registrar." }, { status: 500 });
  }

  await admin
    .from("design_dispatches")
    .update({ status: "delivered" })
    .eq("id", dispatch.id);

  await admin.from("design_order_events").insert({
    design_order_id: order.id,
    type: "file_upload",
    actor_side: "system",
    message: `${designer.full_name} entregó el diseño (v${body.version}): ${body.file_name}`,
    is_internal: true,
  });

  // [044] A dónde va la orden y si el cliente se entera. El archivo ya está
  // guardado: si esto falla, el diseño NO se pierde, solo queda sin mover.
  const { data: completa } = await admin
    .from("design_orders")
    .select("status, client_org_id, revision_count, first_delivery_at, created_by")
    .eq("id", order.id)
    .maybeSingle();

  const publicacion = completa
    ? await publicarDiseno(admin, {
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: completa.status,
        patientRef: order.patient_ref,
        revisionCount: completa.revision_count ?? 0,
        firstDeliveryAt: completa.first_delivery_at ?? null,
        createdBy: completa.created_by ?? null,
        studioOrgId: dispatch.studio_org_id,
        clientOrgId: completa.client_org_id,
        baseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || httpRequest.nextUrl.origin,
      })
    : null;

  logger.info(
    "[entrega] diseño recibido para", order.order_number, "v" + body.version,
    "→", publicacion?.destino ?? "sin publicar",
  );

  return NextResponse.json({
    data: {
      version: body.version,
      destino: publicacion?.destino ?? null,
      aviso_al_cliente: publicacion?.avisoAlCliente ?? null,
    },
  });
}
