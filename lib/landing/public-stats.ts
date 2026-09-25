/**
 * Cifras reales para la landing. Salen de la base en cada render (con
 * caché de la página) y se redondean hacia abajo: "+550" nunca miente.
 * Si la consulta falla, se devuelve null y la sección no se muestra:
 * mejor sin cifras que con cifras inventadas.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DESIGN_SERVICES } from "@/lib/design/services";

export interface PublicStats {
  orders: number;
  clinics: number;
  services: number;
  turnaround: string;
}

const floorTo = (n: number, step: number) => Math.floor(n / step) * step;

export async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const supabase = createAdminClient();
    const { data: lab } = await supabase
      .from("organizations")
      .select("id")
      .eq("type", "lab")
      .ilike("name", "digital dent%")
      .limit(1)
      .maybeSingle();
    if (!lab) return null;

    const [{ count: orders }, { count: clinics }] = await Promise.all([
      supabase.from("lab_orders").select("id", { count: "exact", head: true }).eq("lab_org_id", lab.id),
      supabase
        .from("lab_dentist_relations")
        .select("id", { count: "exact", head: true })
        .eq("lab_org_id", lab.id)
        .eq("status", "active"),
    ]);
    if (!orders || !clinics) return null;

    const hours = DESIGN_SERVICES.map((s) => s.defaultTurnaroundHours);
    return {
      orders: floorTo(orders, 50),
      clinics: floorTo(clinics, 10),
      services: DESIGN_SERVICES.length,
      turnaround: `${Math.min(...hours)}–${Math.max(...hours)} h`,
    };
  } catch {
    return null;
  }
}
