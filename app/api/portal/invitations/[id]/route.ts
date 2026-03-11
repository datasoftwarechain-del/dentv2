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

    if (invitation.status === "revoked") {
      return NextResponse.json({ error: "La invitación ya fue revocada" }, { status: 400 });
    }

    // Disable auth user if there's a preview org
    if (invitation.preview_org_id) {
      const { data: member } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", invitation.preview_org_id)
        .single();

      if (member?.user_id) {
        // Suspend in org_members
        await supabase
          .from("org_members")
          .update({ status: "suspended" })
          .eq("user_id", member.user_id)
          .eq("org_id", invitation.preview_org_id);

        // Ban auth user for a very long duration (effectively disabled)
        await adminClient.auth.admin.updateUserById(member.user_id, {
          ban_duration: "876600h", // ~100 years
        });
      }
    }

    // Mark invitation as revoked
    const { error: updateError } = await supabase
      .from("client_invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
