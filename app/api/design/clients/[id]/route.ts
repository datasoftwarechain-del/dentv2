/**
 * [035_design_studio] Edición de la relación con un cliente.
 *
 * No hay DELETE a propósito: borrar la relación dejaría huérfanas las
 * órdenes que ese cliente ya mandó (y sus facturas). Se suspende, que
 * corta el envío de casos nuevos sin tocar la historia.
 */

import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { isCollaboratorRole, hasPermission, permissionDeniedMessage } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PatchSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  payment_mode: z.enum(["account", "prepaid"]).optional(),
  turnaround_hours: z.number().int().min(1).max(720).nullish(),
  notes: z.string().max(1000).nullish(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "design_studio") {
      return NextResponse.json({ error: "Solo para estudios de diseño" }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_design_clients")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_design_clients"), missing_flag: "manage_design_clients" },
        { status: 403 },
      );
    }

    const { data: body, error: bodyError } = await validateBody(request, PatchSchema);
    if (bodyError) return bodyError;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) patch.status = body.status;
    if (body.payment_mode !== undefined) patch.payment_mode = body.payment_mode;
    if (body.turnaround_hours !== undefined) patch.turnaround_hours = body.turnaround_hours;
    if (body.notes !== undefined) patch.notes = body.notes;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("design_studio_clients")
      .update(patch)
      .eq("id", id)
      .eq("studio_org_id", org.id) // cinturón además de la RLS
      .select("*, client_org:client_org_id(id, name, type)")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
