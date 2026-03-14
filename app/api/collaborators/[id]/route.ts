import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";
import { normalizePermissions } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const UpdateCollaboratorSchema = z.object({
  orgId: z.string().uuid(),
  displayName: z.string().min(2).max(80).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

/** Verifies the current user is an admin of the org that owns the member record */
async function verifyAdminOwnsCollaborator(
  userId: string,
  memberId: string,
  orgId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Check the caller is admin of the org
  const { data: callerMembership } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .single();

  if (!callerMembership || callerMembership.role === "collaborator") return false;

  // Check the target member belongs to the same org
  const { data: targetMember } = await supabase
    .from("org_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();

  // Cannot modify another admin via this endpoint
  if (!targetMember || targetMember.role !== "collaborator") return false;

  return true;
}

/** PUT /api/collaborators/[id] — update permissions / status / displayName */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id: memberId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const validation = await validateBody(request, UpdateCollaboratorSchema);
    if (validation.error) return validation.error;

    const { orgId, displayName, permissions, status } = validation.data;

    const authorized = await verifyAdminOwnsCollaborator(user.id, memberId, orgId);
    if (!authorized) {
      logger.security(`User ${user.id} attempted to update collaborator ${memberId} in org ${orgId}`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (permissions !== undefined) updates.permissions = normalizePermissions(permissions);
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("org_members")
      .update(updates)
      .eq("id", memberId)
      .select();

    if (error) {
      logger.error("Error updating collaborator:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updated = Array.isArray(data) ? data[0] : data;

    revalidatePath("/dashboard/settings");

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Colaborador actualizado correctamente",
    });
  } catch (error: any) {
    logger.error("PUT /api/collaborators/[id] error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** DELETE /api/collaborators/[id] — remove collaborator from org and delete their auth user */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id: memberId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const orgId = request.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId requerido" }, { status: 400 });
    }

    const authorized = await verifyAdminOwnsCollaborator(user.id, memberId, orgId);
    if (!authorized) {
      logger.security(`User ${user.id} attempted to delete collaborator ${memberId} in org ${orgId}`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Fetch the collaborator's user_id before deleting
    const { data: member, error: fetchError } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("id", memberId)
      .single();

    if (fetchError || !member) {
      return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 });
    }

    // Remove from org_members
    const { error: deleteError } = await supabase
      .from("org_members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      logger.error("Error deleting org_member:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Delete the auth user so they can't log in anymore
    const adminClient = createAdminClient();
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(member.user_id);

    if (authDeleteError) {
      // Log but don't fail — the org_member is already removed
      logger.error("Warning: could not delete auth user for collaborator:", authDeleteError);
    }

    revalidatePath("/dashboard/settings");

    return NextResponse.json({
      success: true,
      message: "Colaborador eliminado correctamente",
    });
  } catch (error: any) {
    logger.error("DELETE /api/collaborators/[id] error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
