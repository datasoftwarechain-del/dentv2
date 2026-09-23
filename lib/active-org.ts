/**
 * [org-switcher] Organización activa del usuario.
 *
 * Un usuario puede pertenecer a varias organizaciones — el dueño de un
 * laboratorio que además tiene un estudio de diseño, por ejemplo. Hasta
 * ahora getUserOrg() tomaba siempre la primera y no había forma de ver
 * las otras: la cuenta existía pero era inalcanzable.
 *
 * La organización elegida vive en una cookie. NO es un dato de confianza:
 * getUserOrg() solo la usa si el id aparece entre las membresías reales
 * del usuario, así que una cookie manipulada no da acceso a nada — cae
 * de nuevo al comportamiento por defecto.
 */

import { cookies } from "next/headers";

export const ACTIVE_ORG_COOKIE = "active_org_id";

/** 30 días: cambiar de organización no debería repetirse cada sesión. */
export const ACTIVE_ORG_MAX_AGE = 60 * 60 * 24 * 30;

/** Id de la organización elegida, o null si nunca se eligió una. */
export async function readActiveOrgId(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  } catch {
    // Fuera de un contexto de request (build estático, por ejemplo).
    return null;
  }
}
