/**
 * [040_lab_requests] Convertir una solicitud web en una orden real.
 *
 * Es la decisión humana del flujo: el laboratorio elige la clínica
 * (existente, o la crea acá mismo), confirma el tipo de trabajo y el
 * precio, y recién entonces nace la lab_order en 'received' con su ítem
 * y con el STL copiado a los archivos del caso.
 *
 * IDEMPOTENCIA
 *   El primer paso es un UPDATE condicional pending_review → converting.
 *   Si dos personas aprietan a la vez, una sola gana; la otra recibe 409.
 *   Si algo falla después, se vuelve a pending_review y se avisa: no
 *   queda una solicitud "convirtiendo" para siempre ni una orden a medias.
 *
 * QUIÉN CREA QUÉ
 *   La clínica nueva se crea con la SESIÓN del usuario (no con service
 *   role): el trigger on_org_created lee auth.uid() para dejarlo como
 *   owner, igual que hace el diálogo de nueva orden. La copia del archivo
 *   sí va con service role porque el bucket de solicitudes es privado.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { resolveLabRequestAccess } from "@/lib/lab-requests/access";
import { buildOrderFromRequest, nextOrderNumber } from "@/lib/lab-requests/convert";
import { LAB_REQUEST_BUCKET } from "@/lib/lab-requests/files";
import { LAB_WORK_TYPES, type LabWorkType } from "@/lib/lab-requests/products";

const WORK_TYPES = LAB_WORK_TYPES as [LabWorkType, ...LabWorkType[]];

const ConvertSchema = z.object({
  // Una de las dos: clínica existente o clínica nueva.
  dentist_org_id: z.string().uuid().nullish(),
  new_clinic: z.object({
    name: z.string().min(2).max(160),
    email: z.string().email().max(200).nullish(),
    phone: z.string().max(40).nullish(),
    address: z.string().max(200).nullish(),
    city: z.string().max(80).nullish(),
  }).nullish(),

  work_type: z.enum(WORK_TYPES),
  catalog_item_id: z.string().uuid().nullish(),
  // 0 es válido: hay trabajos sin costo. null = sin definir todavía.
  unit_price: z.number().min(0).max(9_999_999).nullish(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  internal_notes: z.string().max(2000).nullish(),
}).refine((b) => Boolean(b.dentist_org_id) !== Boolean(b.new_clinic), {
  message: "Elegí una clínica existente o creá una nueva, no las dos.",
});

export async function POST(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { id } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, ConvertSchema);
  if (bodyError) return bodyError;

  const { access, error } = await resolveLabRequestAccess(id, "convert");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { request, orgId, userId, isCollaborator, permissions } = access;

  // Un colaborador sin permiso de precios no puede fijarlo: se guarda el
  // del catálogo (o nada) y el admin lo ajusta.
  const canSetPrice = !isCollaborator || Boolean(permissions?.view_prices);

  if (request.status === "converted" && request.lab_order_id) {
    return NextResponse.json({ data: { lab_order_id: request.lab_order_id, already: true } });
  }
  if (request.status !== "pending_review") {
    return NextResponse.json({ error: "La solicitud ya fue procesada." }, { status: 409 });
  }

  const supabase = await createClient();

  // ─── Cerrojo ───────────────────────────────────────────────────
  const { data: locked } = await supabase
    .from("lab_requests")
    .update({ status: "converting" })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();

  if (!locked) {
    return NextResponse.json({ error: "Otra persona está convirtiendo esta solicitud." }, { status: 409 });
  }

  const rollback = async (reason: string) => {
    await supabase.from("lab_requests").update({ status: "pending_review" }).eq("id", id);
    logger.error(`[lab-requests] convert ${request.request_number} revertida:`, reason);
  };

  try {
    // ─── 1. Clínica ────────────────────────────────────────────────
    let dentistOrgId = body.dentist_org_id ?? null;

    if (body.new_clinic) {
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: body.new_clinic.name.trim(),
          type: "dentist",
          email: body.new_clinic.email?.trim() || request.email,
          phone: body.new_clinic.phone?.trim() || request.phone,
          address: body.new_clinic.address?.trim() || request.address,
          city: body.new_clinic.city?.trim() || request.city,
          is_system_account: false,
        })
        .select("id")
        .single();

      if (orgError || !newOrg) {
        await rollback(orgError?.message ?? "org insert");
        return NextResponse.json({ error: `No se pudo crear la clínica: ${orgError?.message}` }, { status: 500 });
      }
      dentistOrgId = newOrg.id;
    } else if (dentistOrgId) {
      // Tiene que ser una clínica real; no se acepta cualquier UUID.
      const { data: clinic } = await supabase
        .from("organizations")
        .select("id, type")
        .eq("id", dentistOrgId)
        .in("type", ["dentist", "dentist_preview"])
        .maybeSingle();
      if (!clinic) {
        await rollback("clínica inexistente");
        return NextResponse.json({ error: "La clínica elegida no existe." }, { status: 422 });
      }
    }

    if (!dentistOrgId) {
      await rollback("sin clínica");
      return NextResponse.json({ error: "Falta la clínica." }, { status: 422 });
    }

    // Relación lab ↔ clínica, idempotente.
    const { error: relError } = await supabase.from("lab_dentist_relations").upsert(
      { lab_org_id: orgId, dentist_org_id: dentistOrgId, status: "active" },
      { onConflict: "lab_org_id,dentist_org_id", ignoreDuplicates: true },
    );
    if (relError) {
      await rollback(relError.message);
      return NextResponse.json({ error: `No se pudo vincular la clínica: ${relError.message}` }, { status: 500 });
    }

    // ─── 2. Precio ─────────────────────────────────────────────────
    let unitPrice: number | null = null;
    const catalogItemId = body.catalog_item_id ?? request.catalog_item_id ?? null;

    if (canSetPrice && body.unit_price !== undefined) {
      unitPrice = body.unit_price;
    } else if (catalogItemId) {
      const { data: item } = await supabase
        .from("price_catalog")
        .select("base_price")
        .eq("id", catalogItemId)
        .maybeSingle();
      unitPrice = item ? Number(item.base_price) : null;
    }

    // ─── 3. Número y orden ─────────────────────────────────────────
    const { data: latest } = await supabase
      .from("lab_orders")
      .select("order_number")
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = buildOrderFromRequest(
      request,
      {
        dentist_org_id: dentistOrgId,
        work_type: body.work_type,
        catalog_item_id: catalogItemId,
        unit_price: unitPrice,
        due_date: body.due_date ?? null,
        internal_notes: body.internal_notes ?? null,
      },
      nextOrderNumber(latest ?? []),
    );

    const { data: order, error: orderError } = await supabase
      .from("lab_orders")
      .insert({ ...rows.order, created_by: userId })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      await rollback(orderError?.message ?? "order insert");
      return NextResponse.json({ error: `No se pudo crear la orden: ${orderError?.message}` }, { status: 500 });
    }

    const { error: itemError } = await supabase
      .from("lab_order_items")
      .insert({ ...rows.item, order_id: order.id });

    if (itemError) {
      // La orden ya existe: se borra para no dejarla vacía y se revierte.
      await supabase.from("lab_orders").delete().eq("id", order.id);
      await rollback(itemError.message);
      return NextResponse.json({ error: `No se pudo crear el ítem: ${itemError.message}` }, { status: 500 });
    }

    // ─── 4. Archivo → Casos Digitales ──────────────────────────────
    // Se copia (no se mueve): la solicitud conserva su original y el
    // caso queda con el mismo archivo que cualquier otro subido a mano.
    let fileWarning: string | null = null;

    if (request.file_status === "uploaded" && request.storage_path && request.file_name) {
      const admin = createAdminClient();
      const { data: blob, error: dlError } = await admin.storage
        .from(LAB_REQUEST_BUCKET)
        .download(request.storage_path);

      if (dlError || !blob) {
        fileWarning = "La orden se creó pero el archivo no se pudo copiar al caso. Descargalo desde la solicitud.";
        logger.error("[lab-requests] download:", dlError?.message);
      } else {
        const cleanOrderNumber = order.order_number.replace(/\s+/g, "_");
        const casePath = `${order.id}/${cleanOrderNumber}-${request.storage_path.split("/").pop()}`;
        const { error: upError } = await admin.storage
          .from("case-files")
          .upload(casePath, blob, { cacheControl: "3600", upsert: false });

        if (upError) {
          fileWarning = "La orden se creó pero el archivo no se pudo copiar al caso. Descargalo desde la solicitud.";
          logger.error("[lab-requests] copy:", upError.message);
        } else {
          const { data: { publicUrl } } = admin.storage.from("case-files").getPublicUrl(casePath);
          const { error: cfError } = await admin.from("case_files").insert({
            order_id: order.id,
            file_name: request.file_name,
            file_url: publicUrl,
            file_size: request.file_size,
            file_type: "application/octet-stream",
            uploaded_by: userId,
          });
          if (cfError) {
            fileWarning = "El archivo se copió pero no se registró en el caso.";
            logger.error("[lab-requests] case_files:", cfError.message);
          }
        }
      }
    }

    // ─── 5. Cierre ─────────────────────────────────────────────────
    const { error: closeError } = await supabase
      .from("lab_requests")
      .update({
        status: "converted",
        lab_order_id: order.id,
        dentist_org_id: dentistOrgId,
        reviewed_by: userId,
      })
      .eq("id", id);

    if (closeError) {
      // La orden existe. No se revierte: se avisa con el id para que no
      // se cree dos veces.
      logger.error("[lab-requests] close:", closeError.message);
      return NextResponse.json(
        { error: `La orden ${order.order_number} se creó pero la solicitud no se pudo cerrar: ${closeError.message}`, lab_order_id: order.id },
        { status: 500 },
      );
    }

    logger.info(`[lab-requests] ${request.request_number} → ${order.order_number}`);

    return NextResponse.json({
      data: { lab_order_id: order.id, order_number: order.order_number, dentist_org_id: dentistOrgId },
      ...(fileWarning ? { warning: fileWarning } : {}),
    });
  } catch (e) {
    await rollback(e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Error inesperado al convertir." }, { status: 500 });
  }
}
