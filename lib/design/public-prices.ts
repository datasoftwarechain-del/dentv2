/**
 * [design-intake] Precios publicados del estudio, para la landing.
 *
 * Los lee del catálogo real: la página pública y la factura salen de la
 * misma fila de price_catalog. Publicar un precio en una constante del
 * código es como se termina cobrando distinto de lo que dice la web.
 *
 * Solo devuelve los que tienen precio cargado. Los que están en 0 no se
 * publican: es preferible que el servicio aparezca sin importe a que
 * prometa un precio que no es.
 *
 * Usa el cliente de servicio a propósito. La RLS de price_catalog exige
 * ser miembro de la organización, así que un visitante anónimo no ve
 * ninguna fila — que es lo correcto para un catálogo interno, pero deja
 * la landing sin precios. La consulta está acotada a dos columnas de
 * aranceles de diseño activos: exactamente lo que el estudio quiere
 * publicar. No sale nada más por esta puerta.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export async function getPublicDesignPrices(): Promise<Record<string, number>> {
  try {
    const supabase = createAdminClient();

    const { data: studio } = await supabase
      .from("organizations")
      .select("id")
      .eq("type", "design_studio")
      .limit(1)
      .maybeSingle();

    if (!studio) return {};

    const { data: rows } = await supabase
      .from("price_catalog")
      .select("design_service_code, base_price")
      .eq("org_id", studio.id)
      .eq("is_active", true)
      .not("design_service_code", "is", null)
      .gt("base_price", 0);

    return Object.fromEntries(
      (rows ?? []).map((r: any) => [r.design_service_code as string, Number(r.base_price)]),
    );
  } catch {
    // La landing no se cae porque el catálogo no responda: se muestra
    // sin precios, que es un grado menos de información, no un error.
    return {};
  }
}
