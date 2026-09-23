/**
 * [org-switcher] Cambiar de organización activa.
 *
 * Valida que el usuario sea miembro ACTIVO de la organización pedida
 * antes de guardar la cookie. Esa validación se repite después en
 * getUserOrg() al leerla: acá se rechaza temprano con un mensaje claro,
 * allá se ignora en silencio. Las dos capas miran las membresías reales,
 * nunca lo que diga el cliente.
 */

import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_MAX_AGE } from "@/lib/active-org";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SwitchSchema = z.object({
  orgId: z.string().uuid("orgId debe ser un UUID válido"),
});

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: body, error: bodyError } = await validateBody(request, SwitchSchema);
    if (bodyError) return bodyError;

    const { data: membership } = await supabase
      .from("org_members")
      .select("id, status, organization:org_id(id, name, type)")
      .eq("user_id", user.id)
      .eq("org_id", body.orgId)
      .maybeSingle();

    if (!membership) {
      // No se distingue "no existe" de "no sos miembro": decirlo filtraría
      // qué organizaciones existen en la plataforma.
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }
    if (membership.status === "suspended") {
      return NextResponse.json(
        { error: "Tu acceso a esa organización está suspendido" },
        { status: 403 },
      );
    }

    const org = Array.isArray(membership.organization)
      ? membership.organization[0]
      : membership.organization;

    const response = NextResponse.json({ data: org });

    response.cookies.set(ACTIVE_ORG_COOKIE, body.orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACTIVE_ORG_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
