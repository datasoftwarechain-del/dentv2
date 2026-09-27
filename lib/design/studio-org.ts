import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * [042_designers] Qué estudio recibe las postulaciones de diseñadores.
 *
 * Mismo criterio que resolveIntakeLabOrgId() para el laboratorio: primero
 * el entorno, después la única organización de tipo 'design_studio'. Si
 * algún día hay más de una, la variable de entorno desempata.
 */
export async function resolveStudioOrgId(admin: SupabaseClient): Promise<string | null> {
  const fromEnv = process.env.DESIGN_STUDIO_ORG_ID?.trim();
  if (fromEnv) return fromEnv;

  const { data: studios } = await admin
    .from("organizations")
    .select("id")
    .eq("type", "design_studio")
    .order("created_at", { ascending: true })
    .limit(2);

  if (!studios || studios.length === 0) {
    logger.error("[designers] no hay estudio de diseño receptor: definí DESIGN_STUDIO_ORG_ID");
    return null;
  }

  if (studios.length > 1) {
    logger.error("[designers] hay más de un estudio de diseño: definí DESIGN_STUDIO_ORG_ID");
    return null;
  }

  return studios[0].id;
}
