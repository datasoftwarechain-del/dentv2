/**
 * [046] La mecánica del despacho, compartida por el bot y el envío manual.
 *
 * Antes esto vivía dentro de la ruta del botón "Despachar". Cuando el bot
 * pasó a hacer lo mismo, copiarla habría significado dos implementaciones
 * de la regla más delicada del módulo: a quién se le manda un caso clínico
 * y con qué credencial. Una sola, acá.
 *
 * Todo corre con service role porque el bot no tiene sesión. Quién PUEDE
 * despachar se decide antes, en la ruta; esto asume que ya está permitido.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { canTransition, type DesignOrderStatus } from "@/lib/design/status";
import { DESIGN_BUCKET } from "@/lib/design/files";
import { buildCaseEmail, CASE_EMAIL_LINK_TTL_SECONDS } from "@/lib/design/case-email";
import { generarToken, hashDeToken, urlDeEntrega } from "./token";
import {
  vencimientoParaAceptar, momentoDelRecordatorio, agotoIntentos, type Prioridad,
} from "./policy";
import { elegirDisenador, categoriaDelCaso, type CandidatoDisenador } from "./select";

export type ResultadoDespacho =
  | { ok: true; disenador: string; dispatchId: string; intento: number; razon: string }
  | { ok: false; motivo: string; codigo: "sin_candidato" | "ya_despachado" | "sin_intentos" | "envio_fallido" | "error" };

/** Candidatos con su carga actual. Una sola pasada por la tabla de despachos. */
async function cargarCandidatos(
  admin: SupabaseClient,
  studioOrgId: string,
): Promise<CandidatoDisenador[]> {
  const [{ data: aprobados }, { data: abiertos }] = await Promise.all([
    admin
      .from("design_applications")
      .select("id, full_name, is_available, max_concurrent, specialties, last_assigned_at")
      .eq("studio_org_id", studioOrgId)
      .eq("status", "approved"),
    admin
      .from("design_dispatches")
      .select("application_id")
      .eq("studio_org_id", studioOrgId)
      .in("status", ["sent", "accepted"]),
  ]);

  const carga = new Map<string, number>();
  for (const d of abiertos ?? []) {
    const k = d.application_id as string;
    carga.set(k, (carga.get(k) ?? 0) + 1);
  }

  return (aprobados ?? []).map((a) => ({
    id: a.id as string,
    full_name: a.full_name as string,
    is_available: a.is_available as boolean,
    max_concurrent: a.max_concurrent as number,
    specialties: (a.specialties as string[] | null) ?? [],
    casos_abiertos: carga.get(a.id as string) ?? 0,
    last_assigned_at: (a.last_assigned_at as string | null) ?? null,
  }));
}

export async function despacharCaso(
  admin: SupabaseClient,
  params: {
    orderId: string;
    baseUrl: string;
    /** Fijado a mano por el moderador. Sin esto, elige el selector. */
    applicationId?: string;
    /** Quién disparó, para la bitácora. */
    actorId?: string | null;
    incluirArchivos?: boolean;
  },
): Promise<ResultadoDespacho> {
  const { data: order } = await admin
    .from("design_orders")
    .select("id, order_number, status, priority, patient_ref, case_notes, due_at, studio_org_id")
    .eq("id", params.orderId)
    .maybeSingle();

  if (!order) return { ok: false, motivo: "La orden no existe.", codigo: "error" };

  const { count: intentosPrevios } = await admin
    .from("design_dispatches")
    .select("id", { count: "exact", head: true })
    .eq("design_order_id", order.id);

  const intento = (intentosPrevios ?? 0) + 1;

  // El corte: un caso que nadie puede tomar no rota para siempre.
  if (agotoIntentos(intentosPrevios ?? 0)) {
    return {
      ok: false,
      codigo: "sin_intentos",
      motivo: `El caso ya se intentó ${intentosPrevios} veces. Lo toma el moderador.`,
    };
  }

  const { data: items } = await admin
    .from("design_order_items")
    .select("description, service_code, quantity, tooth_positions, arch, notes")
    .eq("design_order_id", order.id)
    .order("created_at");

  // ── A quién ──
  let elegidoId = params.applicationId ?? null;
  let razon = "elegido a mano por el moderador";

  if (!elegidoId) {
    const candidatos = await cargarCandidatos(admin, order.studio_org_id);
    const categoria = categoriaDelCaso((items ?? []).map((i) => i.service_code as string | null));
    const seleccion = elegirDisenador(candidatos, categoria);
    if (!seleccion.elegido) {
      return { ok: false, codigo: "sin_candidato", motivo: seleccion.razon };
    }
    elegidoId = seleccion.elegido.id;
    razon = seleccion.razon;
  }

  const { data: disenador } = await admin
    .from("design_applications")
    .select("id, full_name, email, notify_email")
    .eq("id", elegidoId)
    .eq("status", "approved")
    .maybeSingle();

  if (!disenador) return { ok: false, codigo: "sin_candidato", motivo: "El diseñador no está aprobado." };

  // ── El despacho ──
  const token = generarToken();
  const prioridad = (order.priority === "urgent" ? "urgent" : "normal") as Prioridad;

  const { data: dispatch, error: dispatchError } = await admin
    .from("design_dispatches")
    .insert({
      design_order_id: order.id,
      application_id: disenador.id,
      studio_org_id: order.studio_org_id,
      token_hash: hashDeToken(token),
      token_expires_at: vencimientoParaAceptar(prioridad).toISOString(),
      attempt: intento,
      selection_reason: razon,
    })
    .select("id")
    .single();

  if (dispatchError || !dispatch) {
    if (dispatchError?.code === "23505") {
      return {
        ok: false,
        codigo: "ya_despachado",
        motivo: "Este caso ya está despachado a un diseñador.",
      };
    }
    logger.error("[dispatch] no se pudo crear el despacho:", dispatchError?.message);
    return { ok: false, codigo: "error", motivo: "No se pudo registrar el despacho." };
  }

  // ── El correo ──
  const { data: archivos } = params.incluirArchivos === false
    ? { data: [] as Array<{ file_name: string; storage_path: string }> }
    : await admin
        .from("design_order_files")
        .select("file_name, storage_path")
        .eq("design_order_id", order.id)
        .in("kind", ["input_scan", "input_reference"])
        .order("created_at");

  const firmados = await Promise.all(
    (archivos ?? []).map(async (f) => {
      const { data: signed } = await admin.storage
        .from(DESIGN_BUCKET)
        .createSignedUrl(f.storage_path, CASE_EMAIL_LINK_TTL_SECONDS, { download: f.file_name });
      return { file_name: f.file_name, url: signed?.signedUrl ?? null };
    }),
  );

  const { data: studio } = await admin
    .from("organizations")
    .select("name")
    .eq("id", order.studio_org_id)
    .maybeSingle();

  const { subject, text, html } = buildCaseEmail({
    orderNumber: order.order_number,
    patientRef: order.patient_ref,
    caseNotes: order.case_notes,
    priority: order.priority,
    dueAt: order.due_at,
    items: items ?? [],
    files: firmados,
    studioName: studio?.name?.trim() || "El estudio de diseño",
    designerName: disenador.full_name,
    deliveryUrl: urlDeEntrega(params.baseUrl, token),
  });

  const envio = await sendEmail({
    to: [disenador.notify_email?.trim() || disenador.email],
    subject, text, html,
  });

  if (!envio.ok) {
    // 'failed' y no abierto: si quedara abierto, el índice único trabaría
    // el caso para siempre sin que nadie lo haya recibido.
    await admin
      .from("design_dispatches")
      .update({ status: "failed", failure_reason: envio.reason })
      .eq("id", dispatch.id);
    return { ok: false, codigo: "envio_fallido", motivo: envio.reason };
  }

  await admin
    .from("design_dispatches")
    .update({ email_provider_id: envio.id })
    .eq("id", dispatch.id);

  const patch: Record<string, unknown> = { assigned_application_id: disenador.id };
  if (canTransition(order.status as DesignOrderStatus, "assigned", "system")) patch.status = "assigned";
  await admin.from("design_orders").update(patch).eq("id", order.id);

  await admin
    .from("design_applications")
    .update({ last_assigned_at: new Date().toISOString() })
    .eq("id", disenador.id);

  await admin.from("design_order_events").insert({
    design_order_id: order.id,
    type: "assignment",
    actor_side: params.applicationId ? "studio" : "system",
    actor_id: params.actorId ?? null,
    message: `Caso despachado a ${disenador.full_name} (intento ${intento}): ${razon}`,
    is_internal: true,
  });

  logger.info("[dispatch]", order.order_number, "→", disenador.full_name, "intento", intento);

  return { ok: true, disenador: disenador.full_name, dispatchId: dispatch.id, intento, razon };
}

/**
 * Vence los despachos cuyo token ya expiró y todavía figuran abiertos.
 *
 * Sin esto, un diseñador que no abre el correo congela el caso para
 * siempre: el índice único impide re-despacharlo mientras el viejo siga
 * en 'sent'.
 */
export async function vencerDespachosVencidos(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("design_dispatches")
    .update({ status: "expired" })
    .lt("token_expires_at", new Date().toISOString())
    .in("status", ["sent", "accepted"])
    .select("id, design_order_id");

  for (const d of data ?? []) {
    await admin.from("design_order_events").insert({
      design_order_id: d.design_order_id,
      type: "assignment",
      actor_side: "system",
      message: "El despacho venció sin respuesta: el caso queda libre para reasignar",
      is_internal: true,
    });
    // La orden deja de apuntar a alguien que no lo tomó.
    await admin
      .from("design_orders")
      .update({ assigned_application_id: null })
      .eq("id", d.design_order_id);
  }

  return (data ?? []).length;
}

/** Recordatorio a quien recibió el caso y todavía no lo aceptó. */
export async function enviarRecordatorios(
  admin: SupabaseClient,
  baseUrl: string,
): Promise<number> {
  const { data: pendientes } = await admin
    .from("design_dispatches")
    .select("id, design_order_id, application_id, sent_at, token_expires_at")
    .eq("status", "sent")
    .is("reminded_at", null)
    .limit(50);

  let enviados = 0;

  for (const d of pendientes ?? []) {
    const { data: order } = await admin
      .from("design_orders")
      .select("order_number, priority, patient_ref, due_at")
      .eq("id", d.design_order_id)
      .maybeSingle();
    if (!order) continue;

    const prioridad = (order.priority === "urgent" ? "urgent" : "normal") as Prioridad;
    if (momentoDelRecordatorio(prioridad, new Date(d.sent_at as string)).getTime() > Date.now()) {
      continue; // todavía no le toca
    }

    const { data: designer } = await admin
      .from("design_applications")
      .select("full_name, email, notify_email")
      .eq("id", d.application_id)
      .maybeSingle();
    if (!designer) continue;

    // El recordatorio NO reemite el token: el enlace original sigue vivo y
    // reemitirlo invalidaría el que el diseñador ya tiene abierto.
    const vence = new Date(d.token_expires_at as string).toLocaleDateString("es-UY");
    const envio = await sendEmail({
      to: [designer.notify_email?.trim() || designer.email],
      subject: `Recordatorio · ${order.order_number} sigue esperando`,
      text: [
        `Hola ${designer.full_name},`,
        "",
        `Te asignamos el caso ${order.order_number} y todavía no lo aceptaste.`,
        `El enlace que te mandamos vence el ${vence}.`,
        "",
        "Si no vas a poder tomarlo, avisanos desde el mismo enlace para que lo reasignemos.",
      ].join("\n"),
      html: `<p>Hola ${designer.full_name},</p><p>Te asignamos el caso <strong>${order.order_number}</strong> y todavía no lo aceptaste. El enlace que te mandamos vence el ${vence}.</p><p>Si no vas a poder tomarlo, avisanos desde el mismo enlace para que lo reasignemos.</p>`,
    });

    await admin
      .from("design_dispatches")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", d.id);

    if (envio.ok) enviados++;
  }

  return enviados;
}
