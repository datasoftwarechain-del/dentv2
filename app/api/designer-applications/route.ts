/**
 * [042_designers] Postulación pública de diseñadores ("soy diseñador").
 *
 * No crea cuenta ni organización: deja una fila en design_applications
 * que el estudio revisa desde su bandeja. Mismo contrato que
 * /api/lab-requests: honeypot, validación Zod, clave de idempotencia
 * para que el doble clic no duplique, e inserción con service role
 * porque la tabla no tiene policy de INSERT.
 *
 * PRIVACIDAD: se loguea el número de postulación, nunca el email.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { resolveStudioOrgId } from "@/lib/design/studio-org";

const ApplicationSchema = z.object({
  // Anti-spam: los bots completan todo. Un humano nunca ve este campo.
  website: z.string().max(200).optional(),

  idempotency_key: z.string().uuid("Clave inválida"),

  full_name: z.string().min(2, "Nombre requerido").max(120),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().max(40).nullish(),
  country: z.string().min(2).max(2).default("UY"),
  city: z.string().max(80).nullish(),

  years_experience: z.number().int().min(0).max(60).nullish(),
  software: z.array(z.string().max(40)).max(12).default([]),
  specialties: z.array(z.string().max(40)).max(12).default([]),
  portfolio_url: z.string().url("Enlace inválido").max(300).nullish().or(z.literal("")),
  notes: z.string().max(2000).nullish(),

  accepted_terms: z.literal(true, { message: "Tenés que aceptar los términos" }),
});

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  const { data, error } = await validateBody(request, ApplicationSchema);
  if (error) return error;

  // Honeypot: se responde OK para no darle señal al bot de que fue detectado.
  if (data.website && data.website.trim() !== "") {
    return NextResponse.json({ ok: true, application_number: null });
  }

  const admin = createAdminClient();

  const studioOrgId = await resolveStudioOrgId(admin);
  if (!studioOrgId) {
    return NextResponse.json(
      { error: "No hay estudio de diseño configurado para recibir postulaciones." },
      { status: 503 },
    );
  }

  // Idempotencia: el doble clic devuelve la MISMA postulación, no dos.
  const { data: existing } = await admin
    .from("design_applications")
    .select("application_number")
    .eq("idempotency_key", data.idempotency_key)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, application_number: existing.application_number });
  }

  const portfolio = data.portfolio_url && data.portfolio_url !== "" ? data.portfolio_url : null;

  const { data: created, error: insertError } = await admin
    .from("design_applications")
    .insert({
      studio_org_id: studioOrgId,
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      country: data.country.toUpperCase(),
      city: data.city?.trim() || null,
      years_experience: data.years_experience ?? null,
      software: data.software,
      specialties: data.specialties,
      portfolio_url: portfolio,
      notes: data.notes?.trim() || null,
      source: "landing",
      accepted_terms_at: new Date().toISOString(),
      idempotency_key: data.idempotency_key,
    })
    .select("application_number")
    .single();

  if (insertError || !created) {
    logger.error("[designers] no se pudo guardar la postulación:", insertError?.message);
    return NextResponse.json(
      { error: "No se pudo guardar la postulación. Probá de nuevo en un minuto." },
      { status: 500 },
    );
  }

  logger.info("[designers] postulación recibida", created.application_number);
  return NextResponse.json({ ok: true, application_number: created.application_number });
}
