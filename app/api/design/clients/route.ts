/**
 * [035_design_studio] Clientes de un estudio de diseño.
 *
 * GET  — la cartera del estudio, con el trabajo vivo de cada uno.
 * POST — da de alta a una organización como cliente.
 *
 * El alta es por EMAIL, no por búsqueda de nombre: buscar organizaciones
 * por nombre dejaría enumerar la lista de inquilinos de la plataforma.
 *
 * Si el email NO tiene cuenta, se la crea junto con su organización. Sin
 * eso el estudio no podía arrancar: para habilitar a alguien ese alguien
 * ya tenía que haberse registrado por su cuenta, y nadie se registra en
 * un sistema donde todavía no tiene nada que hacer.
 */

import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { isCollaboratorRole, hasPermission, permissionDeniedMessage } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { findUserByEmail } from "@/lib/design/find-user";

const CreateClientSchema = z.object({
  email: z.string().email("Email inválido"),
  payment_mode: z.enum(["account", "prepaid"]).default("account"),
  turnaround_hours: z.number().int().min(1).max(720).nullish(),
  notes: z.string().max(1000).nullish(),
  /**
   * Datos para crear la cuenta cuando el email no existe todavía. Si la
   * cuenta ya existe se ignoran: no se le renombra la organización a
   * nadie desde acá.
   */
  clinic_name: z.string().min(2).max(160).nullish(),
  contact_name: z.string().min(2).max(120).nullish(),
  /**
    * Tipo de la organización a crear.
    *   design_client = solo pide diseños (lo normal)
    *   dentist / lab = además usa el ERP, si ya te lo contrató
    */
  client_type: z.enum(["design_client", "dentist", "lab"]).default("design_client"),
});

/** GET /api/design/clients */
export async function GET() {
  try {
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

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("design_studio_clients")
      .select("*, client_org:client_org_id(id, name, type)")
      .eq("studio_org_id", org.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** POST /api/design/clients — habilita una organización como cliente */
export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { user, org, role, permissions } = await getUserOrg();

    if (org.type !== "design_studio") {
      return NextResponse.json({ error: "Solo para estudios de diseño" }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_design_clients")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_design_clients"), missing_flag: "manage_design_clients" },
        { status: 403 },
      );
    }

    const { data: body, error: bodyError } = await validateBody(request, CreateClientSchema);
    if (bodyError) return bodyError;

    const email = body.email.trim().toLowerCase();
    const admin = createAdminClient();

    let targetUser: Awaited<ReturnType<typeof findUserByEmail>>;
    try {
      targetUser = await findUserByEmail(admin, email);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "No se pudo buscar la cuenta" },
        { status: 500 },
      );
    }
    let clientOrg: { id: string; name: string; type: string } | null = null;
    let createdAccount = false;

    if (targetUser) {
      // Su organización. Se ignoran las preview: son cuentas de vitrina.
      const { data: memberships } = await admin
        .from("org_members")
        .select("org_id, organization:org_id(id, name, type)")
        .eq("user_id", targetUser.id);

      clientOrg = (memberships ?? [])
        .map((m: any) => (Array.isArray(m.organization) ? m.organization[0] : m.organization))
        .find((o: any) => o && o.type !== "dentist_preview") ?? null;
    }

    // ─── No existe: se crea la cuenta y su organización ─────────
    if (!targetUser || !clientOrg) {
      const clinicName = body.clinic_name?.trim();
      if (!clinicName) {
        return NextResponse.json(
          {
            error: "Esa cuenta no existe todavía. Indicá el nombre de la clínica o laboratorio para crearla.",
            code: "needs_clinic_name",
          },
          { status: 422 },
        );
      }

      if (!targetUser) {
        // email_confirm: true — el alta la hace el estudio, que ya conoce
        // al cliente. La contraseña se define con el enlace de acceso que
        // se devuelve abajo; nunca se inventa una que haya que comunicar.
        const { data: created, error: userError } = await admin.auth.admin.createUser({
          email,
          password: randomBytes(24).toString("base64url"),
          email_confirm: true,
          user_metadata: {
            first_name: body.contact_name?.trim() ?? clinicName,
            source: "design_studio_invite",
          },
        });
        if (userError || !created?.user) {
          return NextResponse.json(
            { error: userError?.message ?? "No se pudo crear la cuenta" },
            { status: 500 },
          );
        }
        targetUser = created.user;
        createdAccount = true;
      }

      // is_system_account arranca apagado para que el trigger
      // on_org_created no intente insertar la membresía con auth.uid(),
      // que con el cliente de servicio es NULL.
      const { data: newOrg, error: orgError } = await admin
        .from("organizations")
        .insert({ name: clinicName, type: body.client_type, is_system_account: false })
        .select("id, name, type")
        .single();

      if (orgError || !newOrg) {
        if (createdAccount) await admin.auth.admin.deleteUser(targetUser.id);
        return NextResponse.json(
          { error: orgError?.message ?? "No se pudo crear la organización" },
          { status: 500 },
        );
      }

      const { error: memberError } = await admin
        .from("org_members")
        .insert({ org_id: newOrg.id, user_id: targetUser.id, role: "owner" });

      if (memberError) {
        await admin.from("organizations").delete().eq("id", newOrg.id);
        if (createdAccount) await admin.auth.admin.deleteUser(targetUser.id);
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }

      await admin.from("organizations")
        .update({ is_system_account: true }).eq("id", newOrg.id);

      clientOrg = newOrg;
    }

    if (clientOrg.id === org.id) {
      return NextResponse.json(
        { error: "Un estudio no puede ser cliente de sí mismo." },
        { status: 409 },
      );
    }

    const supabase = await createClient();

    const { data: relation, error: insertError } = await supabase
      .from("design_studio_clients")
      .upsert(
        {
          studio_org_id: org.id,
          client_org_id: clientOrg.id,
          status: "active",
          payment_mode: body.payment_mode,
          turnaround_hours: body.turnaround_hours ?? null,
          notes: body.notes ?? null,
          created_by: user.id,
        },
        { onConflict: "studio_org_id,client_org_id" },
      )
      .select("*, client_org:client_org_id(id, name, type)")
      .single();

    if (insertError || !relation) {
      return NextResponse.json(
        { error: insertError?.message ?? "No se pudo habilitar al cliente" },
        { status: 500 },
      );
    }

    // Enlace de acceso de un solo uso, para que el estudio se lo pase al
    // cliente. Evita tener que inventar y comunicar una contraseña.
    let accessUrl: string | null = null;
    if (createdAccount) {
      const { data: link } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${request.nextUrl.origin}/auth/callback?next=/dashboard/design` },
      });
      accessUrl = link?.properties?.action_link ?? null;
    }

    return NextResponse.json(
      { data: relation, created_account: createdAccount, access_url: accessUrl },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
