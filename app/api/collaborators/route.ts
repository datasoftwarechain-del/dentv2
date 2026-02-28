import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsOrganization } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";
import { normalizePermissions, EMPTY_PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const InviteCollaboratorSchema = z.object({
  orgId: z.string().uuid("orgId debe ser un UUID válido"),
  displayName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña no puede superar 72 caracteres"),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

/** GET /api/collaborators?orgId=xxx — list collaborators for an org */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const orgId = request.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId requerido" }, { status: 400 });
    }

    // Only org admins can list collaborators
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .single();

    if (!membership || membership.role === "collaborator") {
      logger.security(`User ${user.id} attempted to list collaborators for org ${orgId}`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Fetch all collaborators with their permissions
    const { data: members, error } = await supabase
      .from("org_members")
      .select("id, user_id, role, permissions, status, display_name, invited_by, created_at")
      .eq("org_id", orgId)
      .eq("role", "collaborator")
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Error fetching collaborators:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with emails via admin API (service role)
    const adminClient = createAdminClient();
    const enriched = await Promise.all(
      (members || []).map(async (m) => {
        try {
          const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(m.user_id);
          return { ...m, email: authUser?.email ?? null };
        } catch {
          return { ...m, email: null };
        }
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (error: any) {
    logger.error("GET /api/collaborators error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** POST /api/collaborators — create a new collaborator account */
export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const validation = await validateBody(request, InviteCollaboratorSchema);
    if (validation.error) return validation.error;

    const { orgId, displayName, email, password, permissions } = validation.data;

    // Only admins of this org can create collaborators
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .single();

    if (!membership || membership.role === "collaborator") {
      logger.security(`User ${user.id} attempted to create collaborator for org ${orgId}`);
      return NextResponse.json(
        { error: "Los colaboradores no pueden agregar otros colaboradores" },
        { status: 403 }
      );
    }

    const resolvedPermissions = permissions
      ? normalizePermissions(permissions)
      : EMPTY_PERMISSIONS;

    // Create the Supabase auth user via service role (admin API)
    const adminClient = createAdminClient();
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification — admin already knows the user
      user_metadata: {
        first_name: displayName.split(" ")[0] ?? displayName,
        last_name: displayName.split(" ").slice(1).join(" ") || "",
      },
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes("already") || createError.message?.toLowerCase().includes("registered") || createError.message?.toLowerCase().includes("email address")) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese email" },
          { status: 409 }
        );
      }
      logger.error("Error creating collaborator auth user:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser?.user) {
      return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
    }

    // Add to org_members as collaborator
    const { data: member, error: memberError } = await supabase
      .from("org_members")
      .insert({
        user_id: newUser.user.id,
        org_id: orgId,
        role: "collaborator",
        permissions: resolvedPermissions,
        status: "active",
        display_name: displayName,
        invited_by: user.id,
      })
      .select()
      .single();

    if (memberError) {
      // Rollback: delete the auth user we just created
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      logger.error("Error inserting collaborator org_member (rolled back):", memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    revalidatePath("/dashboard/settings");

    return NextResponse.json({
      success: true,
      data: { ...member, email },
      message: "Colaborador creado correctamente",
    });
  } catch (error: any) {
    logger.error("POST /api/collaborators error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
