import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/get-user-org";
import { canViewPrices } from "@/lib/permissions";
import { getEffectivePricesBatch } from "@/lib/pricing";

/**
 * GET /api/catalog/[orgId]
 *
 * Devuelve el catálogo activo de una organización de tipo "lab".
 * Usa el admin client (service role) para bypassear la RLS que bloquea
 * a los dentistas de leer el catálogo de sus laboratorios conectados.
 *
 * Seguridad:
 * - El usuario debe estar autenticado
 * - Solo se exponen catálogos de orgs de tipo "lab" (nunca dentistas)
 * - Si el caller es colaborador sin `view_prices`, los montos
 *   (`base_price`, `extras[].price`) se eliminan de la respuesta para
 *   evitar fuga vía curl directo al endpoint (defensa en dos capas
 *   junto con la UI gating en create/edit forms).
 *
 * Override resolution:
 * - Cuando el caller es un dentista, enriquecemos cada item con
 *   `effective_price` y `has_override` aplicando el override del par
 *   (lab=orgId, dentist=org del caller). Replica el patrón de
 *   `app/dashboard/orders/[id]/edit/page.tsx` para que el formulario
 *   de creación pueda persistir `unit_price` correcto sin sumarle extras.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    // 1. Verificar sesión + cargar permisos del caller
    const { user, org: callerOrg, permissions } = await getUserOrg();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const showPrices = canViewPrices(permissions);

    // 2. Usar admin client para leer catálogo (bypasea RLS)
    const admin = createAdminClient();

    // Verificar que la org es un lab (nunca exponer catálogos de dentistas)
    const { data: org } = await admin
      .from("organizations")
      .select("type")
      .eq("id", orgId)
      .single();

    if (!org || org.type !== "lab") {
      return NextResponse.json({ catalog: [] });
    }

    // 3. Leer catálogo activo
    const { data: catalog, error } = await admin
      .from("price_catalog")
      .select("id, category, name, base_price, extras")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("category")
      .order("sort_order")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (catalog ?? []) as {
      id: string;
      category: string;
      name: string;
      base_price: number;
      extras: unknown;
    }[];

    // 4. Resolver effective_price por cliente cuando el caller es dentista.
    // El par (lab=orgId, dentist=callerOrg.id) determina si hay override.
    // Si el caller es lab (mismo org u otro), no aplica override de cliente:
    // devolvemos effective_price = base_price.
    let overrideMap = new Map<string, { effective: number; base: number; hasOverride: boolean }>();
    if (callerOrg?.type === "dentist" && callerOrg.id && items.length > 0) {
      overrideMap = await getEffectivePricesBatch(
        admin,
        orgId,
        callerOrg.id,
        items,
      );
    }

    const enriched = items.map((c) => {
      const eff = overrideMap.get(c.id);
      return {
        ...c,
        effective_price: eff?.effective ?? c.base_price,
        has_override: eff?.hasOverride ?? false,
      };
    });

    // 5. Sanitizar montos para colaboradores sin view_prices.
    // Estructuralmente preservamos los campos para no romper el cliente,
    // pero seteamos los precios a 0 — el form computa unitPrice = 0 y
    // el backend (PATCH /api/orders/[id]) rellenará el unit_price real
    // desde el catálogo cuando reciba un nuevo item con catalog_item_id
    // y unit_price nulo/0.
    const safe = showPrices
      ? enriched
      : enriched.map((c) => ({
          ...c,
          base_price: 0,
          effective_price: 0,
          extras: Array.isArray(c.extras)
            ? c.extras.map((e: any) => ({ ...e, price: 0 }))
            : c.extras,
        }));

    return NextResponse.json({ catalog: safe });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
