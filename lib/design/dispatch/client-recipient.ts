/**
 * [044] A qué dirección se le avisa al cliente.
 *
 * `organizations.email` es el lugar natural, pero en esta base está vacío
 * en las 54 organizaciones: nadie lo carga. Confiar solo en esa columna
 * haría que el aviso nunca saliera y que el fallo fuera invisible, porque
 * "la org no tiene email" se parece mucho a "no había nada que avisar".
 *
 * Por eso hay tres fuentes, en orden de preferencia:
 *
 *   1. `organizations.email` — si alguien lo cargó, manda.
 *   2. El usuario que creó la orden — es quien está esperando el diseño.
 *   3. Cualquier miembro activo de la organización cliente — el último
 *      recurso antes de no avisarle a nadie.
 *
 * Devuelve también DE DÓNDE salió, para poder decirlo en la bitácora: un
 * aviso que fue a parar al buzón equivocado se diagnostica mirando eso.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type FuenteDestinatario = "org" | "creador" | "miembro";

export interface Destinatario {
  email: string;
  fuente: FuenteDestinatario;
}

async function emailDeUsuario(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

export async function resolverDestinatarioCliente(
  admin: SupabaseClient,
  params: { clientOrgId: string; createdBy: string | null; orgEmail: string | null },
): Promise<Destinatario | null> {
  const desdeOrg = params.orgEmail?.trim();
  if (desdeOrg) return { email: desdeOrg, fuente: "org" };

  if (params.createdBy) {
    const email = await emailDeUsuario(admin, params.createdBy);
    if (email) return { email, fuente: "creador" };
  }

  // Último recurso: un miembro de la org cliente. Se ordena por antigüedad
  // para que el resultado sea estable entre llamadas y no rote al azar.
  const { data: miembros } = await admin
    .from("org_members")
    .select("user_id, created_at")
    .eq("org_id", params.clientOrgId)
    .order("created_at", { ascending: true })
    .limit(5);

  for (const m of miembros ?? []) {
    const email = await emailDeUsuario(admin, m.user_id as string);
    if (email) return { email, fuente: "miembro" };
  }

  return null;
}
