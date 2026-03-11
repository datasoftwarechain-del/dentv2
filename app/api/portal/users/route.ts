import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreatePortalUserSchema = z.object({
  dentistOrgId: z.string().uuid("dentistOrgId debe ser un UUID válido"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Al menos una mayúscula")
    .regex(/[0-9]/, "Al menos un número"),
  displayName: z.string().min(2, "Nombre requerido").max(100),
});

/** POST /api/portal/users — create a portal preview account for a connected dentist client */
export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  const adminClient = createAdminClient();
  let createdAuthUserId: string | null = null;
  let createdPreviewOrgId: string | null = null;

  try {
    const { org, isCollaborator, user } = await getUserOrg();

    if (org.type !== "lab" || isCollaborator) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const validation = await validateBody(request, CreatePortalUserSchema);
    if (validation.error) return validation.error;

    const { dentistOrgId, email, password, displayName } = validation.data;

    const supabase = await createClient();

    // Step 1 — verify the dentist org is connected to this lab
    const { data: relation } = await supabase
      .from("lab_dentist_relations")
      .select("id")
      .eq("lab_org_id", org.id)
      .eq("dentist_org_id", dentistOrgId)
      .single();

    if (!relation) {
      return NextResponse.json(
        { error: "La clínica no está conectada a este laboratorio" },
        { status: 400 }
      );
    }

    // Step 2 — get dentist org name for the preview org name
    const { data: dentistOrg } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", dentistOrgId)
      .single();

    if (!dentistOrg) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    // Step 3 — create preview org
    const { data: previewOrg, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: `${dentistOrg.name} (Preview)`,
        type: "dentist_preview",
        is_system_account: true,
      })
      .select()
      .single();

    if (orgError || !previewOrg) {
      return NextResponse.json(
        { error: orgError?.message ?? "Error al crear organización preview" },
        { status: 500 }
      );
    }
    createdPreviewOrgId = previewOrg.id;

    // Step 4 — create auth user via admin API
    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: displayName.split(" ")[0] ?? displayName,
        last_name: displayName.split(" ").slice(1).join(" ") || "",
      },
    });

    if (createError || !newUserData?.user) {
      // Rollback: delete preview org
      await supabase.from("organizations").delete().eq("id", createdPreviewOrgId);
      if (createError?.message?.toLowerCase().includes("already") ||
          createError?.message?.toLowerCase().includes("registered") ||
          createError?.message?.toLowerCase().includes("email address")) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese email" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: createError?.message ?? "Error al crear usuario" },
        { status: 500 }
      );
    }
    createdAuthUserId = newUserData.user.id;

    // Step 5 — create org_member linking user to preview org
    const { error: memberError } = await supabase
      .from("org_members")
      .insert({
        user_id: createdAuthUserId,
        org_id: createdPreviewOrgId,
        role: "admin",
        permissions: {},
        status: "active",
        display_name: displayName,
        invited_by: user.id,
      });

    if (memberError) {
      // Rollback auth user and preview org
      await adminClient.auth.admin.deleteUser(createdAuthUserId);
      await supabase.from("organizations").delete().eq("id", createdPreviewOrgId);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Step 6 — insert client_invitation with status='active'
    const { error: inviteError } = await supabase
      .from("client_invitations")
      .insert({
        lab_org_id: org.id,
        dentist_org_id: dentistOrgId,
        preview_org_id: createdPreviewOrgId,
        invited_email: email,
        display_name: displayName,
        status: "active",
        created_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      // Rollback
      await supabase.from("org_members").delete().eq("user_id", createdAuthUserId);
      await adminClient.auth.admin.deleteUser(createdAuthUserId);
      await supabase.from("organizations").delete().eq("id", createdPreviewOrgId);

      if (inviteError.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una invitación para ese email en este laboratorio" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    // Do NOT return the password in the response
    return NextResponse.json({
      success: true,
      email,
      displayName,
    });
  } catch (error: any) {
    // Best-effort rollback on unexpected error
    if (createdAuthUserId) {
      try { await adminClient.auth.admin.deleteUser(createdAuthUserId); } catch {}
    }
    if (createdPreviewOrgId) {
      try {
        const supabase = await createClient();
        await supabase.from("organizations").delete().eq("id", createdPreviewOrgId);
      } catch {}
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
