/**
 * [design] Buscar una cuenta por email con el cliente de servicio.
 *
 * supabase-js no tiene getUserByEmail: lo único que hay es listUsers
 * paginado. La versión anterior pedía una sola página de 1000 y daba por
 * hecho que ahí estaban todos — con 200 usuarios ya cargados, eso se
 * rompía en silencio al llegar al 1001: "no existe" para alguien que sí.
 *
 * Esto recorre las páginas hasta encontrarlo o agotarlas. Es O(n) en
 * usuarios, pero correcto; y solo lo usa el alta de clientes desde el
 * estudio, que es una operación de mostrador, no de tráfico.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

const PAGE = 500;

export async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<User | null> {
  const wanted = email.trim().toLowerCase();

  for (let page = 1; page < 200; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;

    const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (hit) return hit;

    if (data.users.length < PAGE) return null; // última página
  }
  return null;
}

/** ¿Este error de createUser significa "ya existe"? */
export function isDuplicateUserError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return /already|ya (existe|registrad)/i.test(error.message ?? "");
}
