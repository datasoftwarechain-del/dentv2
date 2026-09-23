/**
 * [035_design_studio] Cuánto trabajo está esperando una acción tuya.
 *
 * Sin servicio de email instalado, esta es la notificación que sí puede
 * existir hoy: un contador en el menú. La regla es que cuente solo lo
 * accionable POR VOS — si contara todo el trabajo vivo, el número nunca
 * bajaría a cero y en dos días nadie lo miraría más.
 *
 * Cuando haya un proveedor de email, este mismo criterio decide a quién
 * se le escribe: lo que acá suma, allá se notifica.
 */

import { createClient } from "@/lib/supabase/server";
import { DESIGN_STATUS_ACTIVE, DESIGN_STATUS_AWAITING_CLIENT } from "./status";

/** Estados en los que la pelota está del lado del ESTUDIO. */
const AWAITING_STUDIO = DESIGN_STATUS_ACTIVE.filter(
  (s) => !DESIGN_STATUS_AWAITING_CLIENT.includes(s),
);

/**
 * Cuántas órdenes de diseño esperan algo de esta organización.
 *
 * Nunca lanza: si el módulo todavía no está migrado, devuelve 0 en vez de
 * tumbar el layout entero del dashboard por una tabla que no existe.
 */
export async function countPendingDesignOrders(
  orgId: string,
  orgType: string,
): Promise<number> {
  // Las cuentas de vitrina no participan del módulo.
  if (orgType === "dentist_preview") return 0;

  try {
    const supabase = await createClient();
    const isStudio = orgType === "design_studio";

    const { count, error } = await supabase
      .from("design_orders")
      .select("id", { count: "exact", head: true })
      .eq(isStudio ? "studio_org_id" : "client_org_id", orgId)
      .in("status", isStudio ? AWAITING_STUDIO : DESIGN_STATUS_AWAITING_CLIENT);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
