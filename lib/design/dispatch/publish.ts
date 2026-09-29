/**
 * [044] Qué pasa cuando llega el diseño terminado.
 *
 * Dos caminos, y cuál se toma lo decide el estudio con un interruptor:
 *
 *   - **Control interno (por defecto).** La orden va a `internal_review` y
 *     alguien del estudio mira antes de que el cliente vea nada. Es el
 *     valor por defecto a propósito: el archivo lo subió alguien SIN
 *     cuenta, y que eso llegue solo al cliente es demasiado camino sin un
 *     par de ojos. Se enciende el automático cuando el flujo tenga
 *     historial.
 *   - **Automático.** La orden va a `client_review` y al cliente le llega
 *     el aviso.
 *
 * El interruptor vive en `organizations.settings` del estudio, bajo
 * `design_auto_client_review`. Es jsonb, así que no necesita migración:
 *
 *   UPDATE organizations
 *   SET settings = COALESCE(settings,'{}'::jsonb) || '{"design_auto_client_review":true}'::jsonb
 *   WHERE id = '<uuid del estudio>';
 *
 * NO libera el entregable. El STL se libera recién cuando el cliente
 * APRUEBA (paso 6 de /api/design/orders/[id]/status). Publicar acá lo que
 * todavía no se aprobó saltearía la compuerta de cobro del modo 'prepaid'.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { buildClientReadyEmail } from "@/lib/design/client-email";
import { canTransition, type DesignOrderStatus } from "@/lib/design/status";
import { resolverDestinatarioCliente } from "./client-recipient";

export type DestinoPublicacion = "internal_review" | "client_review";

export interface ResultadoPublicacion {
  destino: DestinoPublicacion;
  /** Se movió el estado de la orden. False si la transición no estaba permitida. */
  movida: boolean;
  /** Se le avisó al cliente. Null cuando el destino es control interno. */
  avisoAlCliente: { enviado: boolean; motivo?: string } | null;
}

/** Lee el interruptor del estudio. Ante la duda, control interno. */
export function quiereRevisionAutomatica(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  return (settings as Record<string, unknown>).design_auto_client_review === true;
}

export async function publicarDiseno(
  admin: SupabaseClient,
  params: {
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    patientRef: string | null;
    revisionCount: number;
    /** Quién creó la orden: respaldo cuando la org cliente no tiene email. */
    createdBy: string | null;
    /** Si ya tenía primera entrega, no se pisa: las métricas miden desde la PRIMERA. */
    firstDeliveryAt: string | null;
    studioOrgId: string;
    clientOrgId: string;
    baseUrl: string;
  },
): Promise<ResultadoPublicacion> {
  const [{ data: studio }, { data: client }] = await Promise.all([
    admin.from("organizations").select("name, settings").eq("id", params.studioOrgId).maybeSingle(),
    admin.from("organizations").select("name, email").eq("id", params.clientOrgId).maybeSingle(),
  ]);

  const automatico = quiereRevisionAutomatica(studio?.settings);
  const destino: DestinoPublicacion = automatico ? "client_review" : "internal_review";

  let movida = false;
  if (canTransition(params.orderStatus as DesignOrderStatus, destino, "system")) {
    const patch: Record<string, unknown> = { status: destino };
    // Solo la PRIMERA entrega sella la fecha: el turnaround de metrics.ts se
    // mide contra ella, y pisarla en cada revisión lo haría parecer instantáneo.
    if (!params.firstDeliveryAt) patch.first_delivery_at = new Date().toISOString();

    const { error } = await admin
      .from("design_orders")
      .update(patch)
      .eq("id", params.orderId)
      // Guardia contra dos entregas simultáneas: solo mueve desde donde estaba.
      .eq("status", params.orderStatus);
    movida = !error;
    if (error) logger.error("[publicar] no se pudo mover la orden:", error.message);
  }

  await admin.from("design_order_events").insert({
    design_order_id: params.orderId,
    type: "status_change",
    actor_side: "system",
    from_status: params.orderStatus,
    to_status: movida ? destino : null,
    message: automatico
      ? "Diseño recibido: pasa a revisión del cliente"
      : "Diseño recibido: queda en control interno del estudio",
    is_internal: !automatico,
  });

  if (!automatico) {
    return { destino, movida, avisoAlCliente: null };
  }

  // ── Aviso al cliente ──
  if (!isEmailConfigured()) {
    return { destino, movida, avisoAlCliente: { enviado: false, motivo: "correo no configurado" } };
  }
  const destinatario = await resolverDestinatarioCliente(admin, {
    clientOrgId: params.clientOrgId,
    createdBy: params.createdBy,
    orgEmail: client?.email ?? null,
  });

  if (!destinatario) {
    logger.error("[publicar] sin destinatario para la org cliente:", params.clientOrgId);
    await admin.from("design_order_events").insert({
      design_order_id: params.orderId,
      type: "message",
      actor_side: "system",
      message: "No se pudo avisar al cliente: no hay ninguna dirección de correo conocida.",
      is_internal: true,
    });
    return { destino, movida, avisoAlCliente: { enviado: false, motivo: "el cliente no tiene email" } };
  }

  const { subject, text, html } = buildClientReadyEmail({
    orderNumber: params.orderNumber,
    patientRef: params.patientRef,
    studioName: studio?.name?.trim() || "El estudio de diseño",
    clientName: client?.name?.trim() || "equipo",
    orderUrl: `${params.baseUrl.replace(/\/$/, "")}/dashboard/design/${params.orderId}`,
    revisionCount: params.revisionCount,
  });

  const resultado = await sendEmail({ to: [destinatario.email], subject, text, html });

  if (!resultado.ok) {
    // El aviso fallido NO deshace la publicación: el diseño está entregado
    // igual y el cliente lo ve al entrar. Queda registrado para reintentar.
    logger.error("[publicar] no se pudo avisar al cliente:", resultado.reason);
    await admin.from("design_order_events").insert({
      design_order_id: params.orderId,
      type: "message",
      actor_side: "system",
      message: `No se pudo avisar al cliente por correo: ${resultado.reason}`,
      is_internal: true,
    });
    return { destino, movida, avisoAlCliente: { enviado: false, motivo: resultado.reason } };
  }

  // De dónde salió la dirección queda asentado: un aviso que fue a parar al
  // buzón equivocado se diagnostica mirando esto.
  if (destinatario.fuente !== "org") {
    await admin.from("design_order_events").insert({
      design_order_id: params.orderId,
      type: "message",
      actor_side: "system",
      message: `Aviso al cliente enviado al correo ${
        destinatario.fuente === "creador" ? "de quien creó la orden" : "de un miembro de la organización"
      } (la organización no tiene email cargado).`,
      is_internal: true,
    });
  }

  return { destino, movida, avisoAlCliente: { enviado: true } };
}
