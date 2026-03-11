import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { NextRequest, NextResponse } from "next/server";

/** DELETE /api/portal/invitations/[id] — revoke a portal access */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { org, role } = await getUserOrg();

    if (org.type !== "lab" || role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Fetch the invitation and verify ownership
    const { data: invitation, error: fetchError } = await supabase
      .from("client_invitations")
      .select("id, lab_org_id, preview_org_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    if (invitation.lab_org_id !== org.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Delete auth user and preview org if they exist
    if (invitation.preview_org_id) {
      const { data: member } = await adminClient
        .from("org_members")
        .select("user_id")
        .eq("org_id", invitation.preview_org_id)
        .single();

      if (member?.user_id) {
        // Delete auth user entirely (so email can be reused)
        await adminClient.auth.admin.deleteUser(member.user_id);
        // org_members row will be cleaned up by cascade or next step
        await adminClient
          .from("org_members")
          .delete()
          .eq("user_id", member.user_id)
          .eq("org_id", invitation.preview_org_id);
      }

      // Delete the preview org
      await adminClient
        .from("organizations")
        .delete()
        .eq("id", invitation.preview_org_id);
    }

    // Delete the invitation row entirely so the email can be reused
    const { error: deleteError } = await adminClient
      .from("client_invitations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** PATCH /api/portal/invitations/[id] — refresh/resend invitation (updates updated_at) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { org, role } = await getUserOrg();

    if (org.type !== "lab" || role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: invitation } = await supabase
      .from("client_invitations")
      .select("id, lab_org_id")
      .eq("id", id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    if (invitation.lab_org_id !== org.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from("client_invitations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Invitación actualizada" });
  } catch (error: any) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
