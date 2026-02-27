import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

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

    // 1. Verificar sesión del usuario
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ catalog: catalog ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
