/**
 * [042_designers] Revisión de una postulación de diseñador (estudio).
 *
 *   PATCH → { action: "approve" }              la habilita como destinatario de casos
 *           { action: "reject", reason }        la cierra
 *           { action: "reopen" }                vuelve a pendiente
 *
 * La RLS de design_applications ya limita las filas a los miembros del
 * estudio, así que un id ajeno devuelve 0 filas y respondemos 404. El
 * permiso fino (manage_design_clients) se chequea acá arriba: es la
 * misma capacidad que dar de alta clientes del estudio.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(500).nullish() }),
  z.object({ action: z.literal("reopen") }),
]);

export async function PATCH(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { id } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, ActionSchema);
  if (bodyError) return bodyError;

  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "design_studio") {
    return NextResponse.json({ error: "Solo el estudio de diseño revisa postulaciones." }, { status: 403 });
  }
  if (isCollaborator && !permissions?.manage_design_clients) {
    return NextResponse.json({ error: "No tenés permiso para revisar postulaciones." }, { status: 403 });
  }

  const supabase = await createClient();

  const patch =
    body.action === "approve"
      ? { status: "approved", reviewed_by: user.id, rejection_reason: null }
      : body.action === "reject"
        ? { status: "rejected", reviewed_by: user.id, rejection_reason: body.reason?.trim() || null }
        : { status: "pending_review", reviewed_by: null, reviewed_at: null, rejection_reason: null };

  const { data: updated, error } = await supabase
    .from("design_applications")
    .update(patch)
    .eq("id", id)
    .select("id, application_number, status")
    .maybeSingle();

  if (error) {
    // 23505 = ya hay otra postulación aprobada con ese email en este estudio.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya hay un diseñador aprobado con ese email." },
        { status: 409 },
      );
    }
    logger.error("[designers] no se pudo actualizar la postulación:", error.message);
    return NextResponse.json({ error: "No se pudo actualizar la postulación." }, { status: 500 });
  }

  if (!updated) return NextResponse.json({ error: "Postulación no encontrada." }, { status: 404 });

  logger.info("[designers]", updated.application_number, "→", updated.status);
  return NextResponse.json({ data: updated });
}
