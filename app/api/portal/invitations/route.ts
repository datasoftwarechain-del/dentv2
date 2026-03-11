import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreateInvitationSchema = z.object({
  dentistOrgId: z.string().uuid("dentistOrgId debe ser un UUID válido"),
  email: z.string().email("Email inválido"),
  displayName: z.string().min(2, "Nombre requerido").max(100),
});

/** GET /api/portal/invitations — list invitations for the current lab */
export async function GET(_request: NextRequest) {
  try {
    const { org, role } = await getUserOrg();

    if (org.type !== "lab" || role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: invitations, error } = await supabase
      .from("client_invitations")
      .select(`
        id,
        invited_email,
        display_name,
        status,
        converted_at,
        created_at,
        updated_at,
        dentist_org:dentist_org_id(id, name),
        preview_org:preview_org_id(id, name)
      `)
      .eq("lab_org_id", org.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: invitations ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** POST /api/portal/invitations — register a pending invitation (without creating auth user) */
export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { org, role, user } = await getUserOrg();

    if (org.type !== "lab" || role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const validation = await validateBody(request, CreateInvitationSchema);
    if (validation.error) return validation.error;

    const { dentistOrgId, email, displayName } = validation.data;

    const supabase = await createClient();

    // Verify dentistOrgId belongs to this lab via lab_dentist_relations
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

    const { data: invitation, error: insertError } = await supabase
      .from("client_invitations")
      .insert({
        lab_org_id: org.id,
        dentist_org_id: dentistOrgId,
        invited_email: email,
        display_name: displayName,
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una invitación para ese email en este laboratorio" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: invitation });
  } catch (error: any) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
