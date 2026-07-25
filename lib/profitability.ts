import { formatWorkType } from "@/lib/work-types";

// ============================================================
// Cálculo puro de rentabilidad (BLOQUE 7)
// ============================================================
// Función sin dependencias de red ni de Next: recibe facturas, ítems
// y el mapa de costos del catálogo, y devuelve el resumen. Se extrae del
// route (app/api/costs/summary) para poder testearla de forma determinista
// (se le pasa `now` en vez de leer el reloj internamente).
// ============================================================

export interface ProfitInvoice {
  total: number;
  created_at: string;
  order_id: string | null;
}

export interface ProfitItem {
  order_id: string;
  quantity?: number | null;
  unit_price?: number | null;
  selected_extras?: { price?: number; qty?: number }[] | null;
  work_type?: string | null;
  catalog_item_id?: string | null;
}

export interface CatalogCost {
  name: string;
  unit_cost: number;
}

export interface ProfitKPIs {
  revenue: number;
  productionCost: number;
  margin: number;
  marginPct: number;
  invoiceCount: number;
  itemsTotal: number;
  itemsWithoutCost: number;
}

export interface WorkTypeRow {
  label: string;
  qty: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

export interface MonthRow {
  month: string;
  revenue: number;
  cost: number;
  margin: number;
}

export interface ProfitSummary {
  monthsWindow: number;
  kpis: ProfitKPIs;
  byWorkType: WorkTypeRow[];
  byMonth: MonthRow[];
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Calcula el resumen de rentabilidad cruzando ingresos (facturas) contra
 * el costo estándar de producción (catálogo). Determinista: `now` se pasa
 * por parámetro para poder testear la ventana temporal.
 */
export function buildProfitabilitySummary(
  invoices: ProfitInvoice[],
  items: ProfitItem[],
  costMap: Map<string, CatalogCost>,
  now: Date,
  monthsToShow = 6,
): ProfitSummary {
  // order_id → mes (para imputar el costo de los ítems al mes de su factura).
  const orderMonth = new Map<string, string>();
  for (const inv of invoices) {
    if (inv.order_id) orderMonth.set(inv.order_id, monthKey(inv.created_at));
  }

  // Ingresos = total facturado real (incluye descuentos/impuestos).
  let revenue = 0;
  for (const inv of invoices) revenue += Number(inv.total ?? 0);

  let productionCost = 0;
  let itemsTotal = 0;
  let itemsWithoutCost = 0;

  const byWork = new Map<string, { label: string; revenue: number; cost: number; qty: number }>();
  const byMonth = new Map<string, { revenue: number; cost: number }>();

  // Semilla de meses (ventana).
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { revenue: 0, cost: 0 });
  }
  for (const inv of invoices) {
    const m = byMonth.get(monthKey(inv.created_at));
    if (m) m.revenue += Number(inv.total ?? 0);
  }

  for (const it of items) {
    itemsTotal++;
    const qty = Number(it.quantity ?? 1);
    const cat = it.catalog_item_id ? costMap.get(it.catalog_item_id) : undefined;
    const unitCost = cat ? cat.unit_cost : 0;
    const hasCost = !!cat && unitCost > 0;
    if (!hasCost) itemsWithoutCost++;

    const lineCost = unitCost * qty;
    productionCost += lineCost;

    const extras = Array.isArray(it.selected_extras) ? it.selected_extras : [];
    const extrasTotal = extras.reduce((s, e) => s + Number(e?.price ?? 0) * Number(e?.qty ?? 1), 0);
    const lineRevenue = Number(it.unit_price ?? 0) * qty + extrasTotal;

    const label = cat?.name?.trim()
      || (it.work_type ? formatWorkType(it.work_type) : "(sin tipo)");
    const w = byWork.get(label) ?? { label, revenue: 0, cost: 0, qty: 0 };
    w.revenue += lineRevenue;
    w.cost += lineCost;
    w.qty += qty;
    byWork.set(label, w);

    const mk = it.order_id ? orderMonth.get(it.order_id) : undefined;
    if (mk) {
      const m = byMonth.get(mk);
      if (m) m.cost += lineCost;
    }
  }

  const margin = revenue - productionCost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

  const byMonthArr: MonthRow[] = Array.from(byMonth.entries()).map(([k, v]) => {
    const [y, m] = k.split("-");
    return {
      month: `${MONTH_NAMES[parseInt(m) - 1]} '${y.slice(2)}`,
      revenue: round2(v.revenue),
      cost: round2(v.cost),
      margin: round2(v.revenue - v.cost),
    };
  });

  const byWorkType: WorkTypeRow[] = Array.from(byWork.values())
    .map((w) => ({
      label: w.label,
      qty: w.qty,
      revenue: round2(w.revenue),
      cost: round2(w.cost),
      margin: round2(w.revenue - w.cost),
      marginPct: w.revenue > 0 ? Math.round(((w.revenue - w.cost) / w.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.margin - a.margin);

  return {
    monthsWindow: monthsToShow,
    kpis: {
      revenue: round2(revenue),
      productionCost: round2(productionCost),
      margin: round2(margin),
      marginPct: Math.round(marginPct * 10) / 10,
      invoiceCount: invoices.length,
      itemsTotal,
      itemsWithoutCost,
    },
    byWorkType,
    byMonth: byMonthArr,
  };
}
