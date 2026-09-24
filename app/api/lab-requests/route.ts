/**
 * [040_lab_requests] Solicitud pública de fresado / impresión.
 *
 * Única puerta abierta a internet del módulo. NO crea cuenta ni
 * organización: deja una fila en lab_requests que el laboratorio
 * revisa y convierte en orden desde su bandeja.
 *
 * QUÉ HACE EN UNA LLAMADA
 *   1. Honeypot: si el campo oculto viene lleno, responde OK y no guarda.
 *   2. Valida (Zod) y aplica la compuerta de país: fuera de Uruguay
 *      responde 422 con la alternativa de diseño digital.
 *   3. Inserta con clave de idempotencia: un doble clic devuelve la
 *      MISMA solicitud, no dos.
 *   4. Si declaró un archivo, emite una URL firmada de subida. La fila
 *      queda en file_status='pending' hasta que PATCH /[id]/file confirme
 *      que el objeto existe. Nada se pierde en silencio: si la subida
 *      falla, la bandeja lo muestra como "Archivo no llegó".
 *
 * PRIVACIDAD
 *   No se pide nombre de paciente, solo un código de referencia. Del
 *   lado servidor se loguea el número de solicitud, no el contenido.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { getLabProduct, LAB_PRODUCT_KEYS } from "@/lib/lab-requests/products";
import { isServiceableCountry } from "@/lib/lab-requests/country";
import {
  LAB_REQUEST_BUCKET, buildLabRequestStoragePath, validateLabRequestFile,
} from "@/lib/lab-requests/files";
import { resolveIntakeLabOrgId } from "@/lib/lab-requests/lab-org";
import { OUT_OF_SCOPE_MESSAGE } from "@/content/servicios";

const RequestSchema = z.object({
  // Anti-spam: los bots completan todo. Un humano nunca ve este campo.
  website: z.string().max(200).optional(),

  idempotency_key: z.string().uuid("Clave inválida"),

  professional_name: z.string().min(2, "Nombre requerido").max(120),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().max(40).nullish(),
  clinic_name: z.string().min(2, "Nombre de la clínica requerido").max(160),
  country: z.string().min(2).max(2),
  department: z.string().max(60).nullish(),
  city: z.string().max(80).nullish(),
  address: z.string().max(200).nullish(),

  product_key: z.string().refine((k) => LAB_PRODUCT_KEYS.includes(k), "Producto desconocido"),
  quantity: z.number().int().min(1).max(99).default(1),
  tooth_positions: z.array(z.string().max(4)).max(32).nullish(),
  shade: z.string().max(40).nullish(),
  urgency: z.enum(["normal", "urgent"]).default("normal"),
  patient_ref: z.string().max(120).nullish(),
  notes: z.string().max(4000).nullish(),

  file: z.object({
    name: z.string().min(1).max(255),
    size: z.number().int().positive(),
  }).nullish(),
  existing_case_ref: z.string().max(120).nullish(),

  accepted_terms: z.literal(true, { message: "Tenés que aceptar los términos" }),
});

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  const { data: body, error } = await validateBody(request, RequestSchema);
  if (error) return error;

  // ─── Honeypot ──────────────────────────────────────────────────
  if (body.website && body.website.trim().length > 0) {
    logger.security("[lab-requests] honeypot lleno, solicitud descartada");
    // Misma respuesta que un alta real para no darle señal al bot.
    return NextResponse.json({ data: { id: null, request_number: "SOL-000000", upload: null } });
  }

  // ─── Alcance ───────────────────────────────────────────────────
  if (!isServiceableCountry(body.country)) {
    return NextResponse.json(
      {
        error: OUT_OF_SCOPE_MESSAGE.title,
        code: "out_of_scope",
        alternative: { label: OUT_OF_SCOPE_MESSAGE.cta, href: "/disenos/solicitar" },
      },
      { status: 422 },
    );
  }

  const product = getLabProduct(body.product_key)!;

  if (product.file === "required" && !body.file && !body.existing_case_ref) {
    return NextResponse.json(
      { error: "Para fresar tu STL necesitamos el archivo, o el número de un caso ya cargado." },
      { status: 422 },
    );
  }
  if (body.file) {
    const check = validateLabRequestFile(body.file.name, body.file.size);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });
  }

  try {
    const admin = createAdminClient();

    const labOrgId = await resolveIntakeLabOrgId(admin);
    if (!labOrgId) {
      return NextResponse.json(
        { error: "El laboratorio no está recibiendo solicitudes en este momento." },
        { status: 503 },
      );
    }

    // Ítem del catálogo por nombre exacto: se congela el id y el nombre
    // para que el laboratorio vea qué precio regía al pedir.
    const { data: catalogItem } = await admin
      .from("price_catalog")
      .select("id, name")
      .eq("org_id", labOrgId)
      .eq("is_active", true)
      .eq("name", product.catalogName)
      .limit(1)
      .maybeSingle();

    // ─── Idempotencia ──────────────────────────────────────────────
    // Primero se busca la clave: un reintento del navegador vuelve con
    // la misma y recibe la misma solicitud. El UNIQUE de la tabla cubre
    // la carrera entre dos llamadas simultáneas.
    const { data: existing } = await admin
      .from("lab_requests")
      .select("id, request_number, storage_path, file_status")
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();

    let row = existing;

    if (!row) {
      const storagePath = body.file ? null : null; // se define tras conocer el id
      const { data: inserted, error: insertError } = await admin
        .from("lab_requests")
        .insert({
          lab_org_id: labOrgId,
          professional_name: body.professional_name.trim(),
          email: body.email.trim().toLowerCase(),
          phone: body.phone?.trim() || null,
          clinic_name: body.clinic_name.trim(),
          country: body.country.toUpperCase(),
          department: body.department?.trim() || null,
          city: body.city?.trim() || null,
          address: body.address?.trim() || null,
          product_key: product.key,
          catalog_name: catalogItem?.name ?? product.catalogName,
          catalog_item_id: catalogItem?.id ?? null,
          material: product.material,
          quantity: body.quantity,
          tooth_positions: body.tooth_positions?.length ? body.tooth_positions : null,
          shade: product.asksShade ? body.shade?.trim() || null : null,
          urgency: body.urgency,
          patient_ref: body.patient_ref?.trim() || null,
          notes: body.notes?.trim() || null,
          file_status: body.file ? "pending" : "none",
          file_name: body.file?.name ?? null,
          file_size: body.file?.size ?? null,
          storage_path: storagePath,
          existing_case_ref: body.existing_case_ref?.trim() || null,
          idempotency_key: body.idempotency_key,
          source: "landing",
          accepted_terms_at: new Date().toISOString(),
        })
        .select("id, request_number, storage_path, file_status")
        .single();

      if (insertError) {
        // 23505 = la carrera: otra llamada con la misma clave ganó.
        if (insertError.code === "23505") {
          const { data: raced } = await admin
            .from("lab_requests")
            .select("id, request_number, storage_path, file_status")
            .eq("idempotency_key", body.idempotency_key)
            .maybeSingle();
          row = raced;
        } else {
          logger.error("[lab-requests] insert:", insertError.message);
          return NextResponse.json({ error: "No se pudo guardar la solicitud." }, { status: 500 });
        }
      } else {
        row = inserted;
      }
    }

    if (!row) {
      return NextResponse.json({ error: "No se pudo guardar la solicitud." }, { status: 500 });
    }

    // ─── URL firmada de subida ─────────────────────────────────────
    // Solo si declaró archivo y todavía no se confirmó. La ruta lleva el
    // id de la solicitud: es lo que la policy de storage usa para dejar
    // que el laboratorio lo lea.
    let upload: { storage_path: string; token: string; signed_url: string } | null = null;

    if (body.file && row.file_status !== "uploaded") {
      const storagePath = row.storage_path ?? buildLabRequestStoragePath(row.id, body.file.name);

      if (!row.storage_path) {
        await admin.from("lab_requests").update({ storage_path: storagePath }).eq("id", row.id);
      }

      const { data: signed, error: signError } = await admin.storage
        .from(LAB_REQUEST_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });

      if (signError || !signed) {
        // La solicitud ya existe: se avisa y queda como "archivo no llegó".
        logger.error("[lab-requests] signed upload:", signError?.message);
        return NextResponse.json(
          {
            data: { id: row.id, request_number: row.request_number, upload: null },
            warning: "La solicitud se registró pero no pudimos preparar la subida del archivo. Te vamos a escribir para pedírtelo.",
          },
          { status: 200 },
        );
      }

      upload = { storage_path: storagePath, token: signed.token, signed_url: signed.signedUrl };
    }

    logger.info(`[lab-requests] ${row.request_number} (${product.key})`);

    return NextResponse.json({
      data: { id: row.id, request_number: row.request_number, upload },
    });
  } catch (e) {
    logger.error("[lab-requests] POST:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Error inesperado. Intentá de nuevo." }, { status: 500 });
  }
}
