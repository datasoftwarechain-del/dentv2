/**
 * [043] Aceptar o rechazar un caso desde el portal del diseñador.
 *
 * Sin sesión: la credencial es el token. Sí lleva CSRF, porque la cookie
 * la puso el proxy al cargar la página y así un tercero no puede hacer
 * que el diseñador acepte un caso desde otro sitio.
 *
 *   POST { action: "accept" }   → toma el caso, la orden pasa a in_design
 *   POST { action: "decline" }  → lo libera para que el estudio lo reasigne
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { resolverToken, MENSAJE_RECHAZO } from "@/lib/design/dispatch/resolve";
import { canTransition } from "@/lib/design/status";
import { vencimientoTrasAceptar } from "@/lib/design/dispatch/policy";
import type { DesignOrderStatus } from "@/lib/design/status";

const AccionSchema = z.object({
  action: z.enum(["accept", "decline"]),
  reason: z.string().max(500).nullish(),
});

export async function POST(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { token } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, AccionSchema);
  if (bodyError) return bodyError;

  const resolucion = await resolverToken(token);
  if (!resolucion.ok) {
    return NextResponse.json({ error: MENSAJE_RECHAZO[resolucion.motivo] }, { status: 403 });
  }

  const { dispatch, designer, order } = resolucion.data;
  const admin = createAdminClient();

  if (body.action === "decline") {
    await admin
      .from("design_dispatches")
      .update({ status: "declined", failure_reason: body.reason?.trim() || null })
      .eq("id", dispatch.id);

    // La orden vuelve a quedar sin diseñador para que el estudio (o el bot)
    // la reasigne. El estado no retrocede: eso lo decide un humano.
    await admin
      .from("design_orders")
      .update({ assigned_application_id: null })
      .eq("id", order.id);

    await admin.from("design_order_events").insert({
      design_order_id: order.id,
      type: "assignment",
      actor_side: "system",
      message: `${designer.full_name} rechazó el caso${body.reason?.trim() ? `: ${body.reason.trim()}` : ""}`,
      is_internal: true,
    });

    logger.info("[entrega] caso", order.order_number, "rechazado por el diseñador");
    return NextResponse.json({ data: { status: "declined" } });
  }

  // ── accept ──
  if (dispatch.status === "accepted") {
    return NextResponse.json({ data: { status: "accepted", yaEstaba: true } });
  }

  // El token se estira para cubrir todo el trabajo, no solo las 48 h de aceptar.
  const nuevoVencimiento = vencimientoTrasAceptar(order.due_at);

  const { error: updateError } = await admin
    .from("design_dispatches")
    .update({ status: "accepted", token_expires_at: nuevoVencimiento.toISOString() })
    .eq("id", dispatch.id)
    // Guardia contra el doble clic: solo pasa de 'sent' a 'accepted'.
    .eq("status", "sent");

  if (updateError) {
    logger.error("[entrega] no se pudo aceptar:", updateError.message);
    return NextResponse.json({ error: "No se pudo aceptar el caso." }, { status: 500 });
  }

  if (canTransition(order.status as DesignOrderStatus, "in_design", "system")) {
    await admin.from("design_orders").update({ status: "in_design" }).eq("id", order.id);
  }

  await admin.from("design_order_events").insert({
    design_order_id: order.id,
    type: "assignment",
    actor_side: "system",
    message: `${designer.full_name} aceptó el caso y empezó el diseño`,
    is_internal: true,
  });

  logger.info("[entrega] caso", order.order_number, "aceptado");
  return NextResponse.json({
    data: { status: "accepted", vence: nuevoVencimiento.toISOString() },
  });
}
