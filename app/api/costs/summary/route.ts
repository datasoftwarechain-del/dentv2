import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import {
  isCollaboratorRole,
  hasPermission,
  permissionDeniedMessage,
} from "@/lib/permissions";
import { buildProfitabilitySummary, type CatalogCost } from "@/lib/profitability";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

// ============================================================
// GET /api/costs/summary — resumen de rentabilidad (BLOQUE 7)
// ============================================================
// Calcula margen real cruzando facturas emitidas (ingresos) contra
// el costo de producción estándar de cada arancel (price_catalog.unit_cost).
// Todo server-side y scopeado por org — no confía en datos del cliente.
//
// Roles: el costo/margen es el dato financiero más sensible. Requiere
// lab + (admin | (view_financial_dashboard Y view_billing_amounts)).
// Un colaborador sin montos NUNCA llega a estos números.
//
// NO MODIFICA NADA EXISTENTE: solo lee. El margen usa join en vivo a
// price_catalog.unit_cost; los ítems sin costo cargado se cuentan aparte
// para que el usuario sepa que el margen todavía es parcial. El cálculo
// vive en lib/profitability.ts (función pura, testeada).
// ============================================================

const MONTHS_TO_SHOW = 6;

export async function GET(_request: NextRequest) {
  try {
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio ve rentabilidad de producción." },
        { status: 403 },
      );
    }

    if (isCollaboratorRole(role)) {
      if (!hasPermission(permissions, "view_financial_dashboard")) {
        return NextResponse.json(
          { error: permissionDeniedMessage("view_financial_dashboard"), missing_flag: "view_financial_dashboard" },
          { status: 403 },
        );
      }
      if (!hasPermission(permissions, "view_billing_amounts")) {
        return NextResponse.json(
          { error: permissionDeniedMessage("view_billing_amounts"), missing_flag: "view_billing_amounts" },
          { status: 403 },
        );
      }
    }

    const supabase = await createClient();

    // Ventana: primer día del mes, MONTHS_TO_SHOW meses atrás.
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_TO_SHOW - 1), 1);
    const windowStartISO = windowStart.toISOString();

    // 1) Facturas emitidas (ingresos) — scopeadas por lab, no anuladas.
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("id, total, created_at, order_id")
      .eq("lab_org_id", org.id)
      .is("invoice_voided_at", null)
      .gte("created_at", windowStartISO);

    if (invErr) throw invErr;

    const invoiceList = (invoices ?? []) as { id: string; total: number; created_at: string; order_id: string | null }[];
    const orderIds = invoiceList.map((i) => i.order_id).filter(Boolean) as string[];

    // 2) Ítems de esas órdenes.
    let items: any[] = [];
    if (orderIds.length > 0) {
      const { data: itemData, error: itemErr } = await supabase
        .from("lab_order_items")
        .select("order_id, quantity, unit_price, selected_extras, work_type, catalog_item_id")
        .in("order_id", orderIds);
      if (itemErr) throw itemErr;
      items = itemData ?? [];
    }

    // 3) Costos de producción del catálogo (scopeado por org).
    const { data: catalog, error: catErr } = await supabase
      .from("price_catalog")
      .select("id, name, unit_cost")
      .eq("org_id", org.id);
    if (catErr) throw catErr;

    const costMap = new Map<string, CatalogCost>();
    for (const c of (catalog ?? []) as any[]) {
      costMap.set(c.id, { name: c.name, unit_cost: Number(c.unit_cost ?? 0) });
    }

    const summary = buildProfitabilitySummary(
      invoiceList,
      items,
      costMap,
      now,
      MONTHS_TO_SHOW,
    );

    return NextResponse.json(summary);
  } catch (err: any) {
    logger.error("Error building profitability summary:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
