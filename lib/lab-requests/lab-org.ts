
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * [040_lab_requests] Qué laboratorio recibe las solicitudes de la landing.
 *
 * En producción hay más de una organización de tipo 'lab' (hay una de
 * prueba), así que "la primera" no sirve. Orden de resolución:
 *   1. LAB_INTAKE_ORG_ID en el entorno del servidor (explícito, preferido)
 *   2. la org 'lab' cuyo nombre empieza con "digital dent": es el mismo
 *      criterio que ya usa getPublicLabPrices() para publicar precios,
 *      así la card y la solicitud miran al mismo catálogo.
 */
export async function resolveIntakeLabOrgId(admin: SupabaseClient): Promise<string | null> {
  const fromEnv = process.env.LAB_INTAKE_ORG_ID?.trim();
  if (fromEnv) return fromEnv;

  const { data: lab } = await admin
    .from("organizations")
    .select("id")
    .eq("type", "lab")
    .ilike("name", "digital dent%")
    .limit(1)
    .maybeSingle();

  if (!lab) {
    logger.error("[lab-requests] no hay laboratorio receptor: definí LAB_INTAKE_ORG_ID");
    return null;
  }
  return lab.id;
}
