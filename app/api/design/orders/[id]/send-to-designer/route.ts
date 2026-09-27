/**
 * [042_designers] Enviar un caso por correo a uno o más diseñadores.
 *
 * Paso intermedio antes del bot: el moderador del estudio elige a quién
 * mandarle el caso y esta ruta arma el correo, lo manda y lo deja
 * registrado en la línea de tiempo de la orden. Cuando el bot automatice
 * el reparto, va a llamar exactamente a esta lógica.
 *
 * Solo el ESTUDIO puede usarla, y solo con permiso de cola: mandar un
 * caso afuera es repartir trabajo, no mirarlo.
 *
 * Los destinatarios salen de design_applications en estado 'approved'.
 * Un email que no esté aprobado no se puede usar: evita que un caso
 * clínico salga a una dirección cargada a mano con un error de tipeo.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { resolveDesignAccess } from "@/lib/design/access";
import { DESIGN_BUCKET } from "@/lib/design/files";
import { buildCaseEmail, CASE_EMAIL_LINK_TTL_SECONDS } from "@/lib/design/case-email";
import { sendEmail, isEmailConfigured } from "@/lib/email";

const SendSchema = z.object({
  designer_ids: z.array(z.string().uuid()).min(1, "Elegí al menos un diseñador").max(10),
  /** Adjuntar enlaces a los escaneos del cliente. Por defecto sí. */
  include_files: z.boolean().default(true),
});

export async function POST(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { id } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, SendSchema);
  if (bodyError) return bodyError;

  const { access, error } = await resolveDesignAccess(id);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  if (access.side !== "studio") {
    return NextResponse.json({ error: "Solo el estudio reparte casos." }, { status: 403 });
  }
  if (access.isCollaborator && !access.permissions?.manage_design_queue) {
    return NextResponse.json({ error: "No tenés permiso para repartir casos." }, { status: 403 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "El envío de correo no está configurado. Definí RESEND_API_KEY y EMAIL_FROM en el servidor.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();

  // Destinatarios: solo aprobados de ESTE estudio. La RLS ya acota la
  // tabla, el filtro por status es la regla de negocio.
  const { data: designers } = await supabase
    .from("design_applications")
    .select("id, full_name, email")
    .in("id", body.designer_ids)
    .eq("status", "approved");

  if (!designers || designers.length === 0) {
    return NextResponse.json(
      { error: "Ninguno de los diseñadores elegidos está aprobado." },
      { status: 422 },
    );
  }

  const [{ data: items }, { data: files }, { data: studio }] = await Promise.all([
    supabase
      .from("design_order_items")
      .select("description, service_code, quantity, tooth_positions, arch, notes")
      .eq("design_order_id", id)
      .order("created_at"),
    body.include_files
      ? supabase
          .from("design_order_files")
          .select("file_name, storage_path, kind")
          .eq("design_order_id", id)
          .in("kind", ["input_scan", "input_reference"])
          .order("created_at")
      : Promise.resolve({ data: [] as { file_name: string; storage_path: string }[] }),
    supabase.from("organizations").select("name").eq("id", access.orgId).maybeSingle(),
  ]);

  // Una URL firmada por archivo, compartida por todos los destinatarios
  // del envío. Si falla la firma, el archivo se lista como no enlazable
  // en vez de desaparecer sin aviso.
  const signedFiles = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data: signed } = await supabase.storage
        .from(DESIGN_BUCKET)
        .createSignedUrl(f.storage_path, CASE_EMAIL_LINK_TTL_SECONDS, { download: f.file_name });
      return { file_name: f.file_name, url: signed?.signedUrl ?? null };
    }),
  );

  const studioName = studio?.name?.trim() || "El estudio de diseño";
  const sent: string[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const designer of designers) {
    const { subject, text, html } = buildCaseEmail({
      orderNumber: access.order.order_number,
      patientRef: access.order.patient_ref,
      caseNotes: access.order.case_notes,
      priority: access.order.priority,
      dueAt: access.order.due_at,
      items: items ?? [],
      files: signedFiles,
      studioName,
      designerName: designer.full_name,
    });

    const result = await sendEmail({ to: [designer.email], subject, text, html });
    if (result.ok) sent.push(designer.full_name);
    else failed.push({ name: designer.full_name, reason: result.reason });
  }

  // Queda en la línea de tiempo de la orden. is_internal: el cliente no
  // tiene por qué ver a qué diseñador se le mandó su caso.
  if (sent.length > 0) {
    await supabase.from("design_order_events").insert({
      design_order_id: id,
      type: "assignment",
      actor_side: "studio",
      actor_id: access.userId,
      message: `Caso enviado por email a ${sent.join(", ")}${
        signedFiles.length ? ` · ${signedFiles.length} archivo(s)` : ""
      }`,
      is_internal: true,
    });
  }

  logger.info(
    "[designers] caso",
    access.order.order_number,
    "enviado a",
    sent.length,
    "fallaron",
    failed.length,
  );

  if (sent.length === 0) {
    return NextResponse.json(
      { error: failed[0]?.reason ?? "No se pudo enviar el caso.", failed },
      { status: 502 },
    );
  }

  return NextResponse.json({ data: { sent, failed } });
}
