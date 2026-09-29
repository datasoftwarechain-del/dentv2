/**
 * [043] Resolver un token de entrega a un despacho utilizable.
 *
 * Es el único guardián del portal del diseñador: no hay sesión, no hay
 * RLS que lo proteja (se entra por service role), así que todo lo que
 * decide si el enlace sirve o no está acá y en un solo lugar.
 *
 * Devuelve un motivo legible en vez de un booleano: la página tiene que
 * poder decir "este enlace venció" en lugar de un 404 que hace que el
 * diseñador escriba preguntando qué pasó.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { hashDeToken, tokenTieneFormaValida } from "./token";

export type MotivoRechazo = "invalido" | "vencido" | "cerrado";

export interface DespachoResuelto {
  dispatch: {
    id: string;
    design_order_id: string;
    application_id: string;
    studio_org_id: string;
    status: "sent" | "accepted";
    attempt: number;
    token_expires_at: string;
    sent_at: string;
  };
  designer: { id: string; full_name: string; email: string };
  order: {
    id: string;
    order_number: string;
    status: string;
    priority: string;
    patient_ref: string | null;
    case_notes: string | null;
    due_at: string | null;
  };
  studioName: string;
}

export type ResolucionToken =
  | { ok: true; data: DespachoResuelto }
  | { ok: false; motivo: MotivoRechazo };

/**
 * Los únicos dos estados que abren el portal.
 *
 * `delivered` ya entregó, `expired` venció, `declined` lo rechazó y
 * `failed` nunca salió. Ninguno debe volver a abrir: el enlace de un caso
 * terminado tiene que dejar de funcionar el mismo día que termina.
 */
const ESTADOS_ABIERTOS = ["sent", "accepted"] as const;

export async function resolverToken(token: string): Promise<ResolucionToken> {
  // Forma primero: filtra escaneos automáticos sin tocar la base.
  if (!tokenTieneFormaValida(token)) return { ok: false, motivo: "invalido" };

  const admin = createAdminClient();

  const { data: dispatch } = await admin
    .from("design_dispatches")
    .select("id, design_order_id, application_id, studio_org_id, status, attempt, token_expires_at, sent_at")
    .eq("token_hash", hashDeToken(token))
    .maybeSingle();

  // Un token que no existe y uno de otro sistema dan lo mismo: "invalido".
  // No se distingue a propósito.
  if (!dispatch) return { ok: false, motivo: "invalido" };

  if (!ESTADOS_ABIERTOS.includes(dispatch.status)) return { ok: false, motivo: "cerrado" };

  if (new Date(dispatch.token_expires_at).getTime() <= Date.now()) {
    return { ok: false, motivo: "vencido" };
  }

  const [{ data: designer }, { data: order }, { data: studio }] = await Promise.all([
    admin
      .from("design_applications")
      .select("id, full_name, email, status")
      .eq("id", dispatch.application_id)
      .maybeSingle(),
    admin
      .from("design_orders")
      .select("id, order_number, status, priority, patient_ref, case_notes, due_at")
      .eq("id", dispatch.design_order_id)
      .maybeSingle(),
    admin
      .from("organizations")
      .select("name")
      .eq("id", dispatch.studio_org_id)
      .maybeSingle(),
  ]);

  // Al diseñador se le puede haber revocado la aprobación entre el envío
  // y la apertura del enlace. En ese caso el enlace deja de servir.
  if (!designer || designer.status !== "approved") return { ok: false, motivo: "cerrado" };
  if (!order) return { ok: false, motivo: "invalido" };

  return {
    ok: true,
    data: {
      dispatch: dispatch as DespachoResuelto["dispatch"],
      designer: { id: designer.id, full_name: designer.full_name, email: designer.email },
      order: order as DespachoResuelto["order"],
      studioName: studio?.name?.trim() || "El estudio de diseño",
    },
  };
}

export const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  invalido: "Este enlace no es válido. Pedile al estudio que te reenvíe el caso.",
  vencido: "Este enlace venció. El estudio ya puede haber reasignado el caso; escribile para retomarlo.",
  cerrado: "Este caso ya no está abierto para vos. Si creés que es un error, escribile al estudio.",
};
