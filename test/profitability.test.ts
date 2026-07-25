import { describe, it, expect } from "vitest";
import {
  buildProfitabilitySummary,
  type ProfitInvoice,
  type ProfitItem,
  type CatalogCost,
} from "@/lib/profitability";

// Reloj fijo: 15 de julio de 2026 → ventana Feb..Jul '26 (6 meses).
const NOW = new Date(2026, 6, 15);

const costMap = new Map<string, CatalogCost>([
  ["cat-a", { name: "Corona", unit_cost: 100 }],
  ["cat-b", { name: "Puente", unit_cost: 0 }], // costo sin cargar
]);

const invoices: ProfitInvoice[] = [
  { total: 500, created_at: "2026-07-05", order_id: "o1" },
  { total: 300, created_at: "2026-06-10", order_id: "o2" },
];

const items: ProfitItem[] = [
  // o1: Corona x2 → costo 200, ingreso 400
  { order_id: "o1", quantity: 2, unit_price: 200, catalog_item_id: "cat-a" },
  // o1: Puente x1 con extra $50 → costo 0 (sin cargar), ingreso 150
  { order_id: "o1", quantity: 1, unit_price: 100, catalog_item_id: "cat-b", selected_extras: [{ price: 50, qty: 1 }] },
  // o2: item sin catálogo → costo 0, ingreso 300
  { order_id: "o2", quantity: 1, unit_price: 300, catalog_item_id: null, work_type: "crown" },
];

describe("buildProfitabilitySummary — KPIs", () => {
  const s = buildProfitabilitySummary(invoices, items, costMap, NOW);

  it("ingresos = suma de facturas", () => {
    expect(s.kpis.revenue).toBe(800);
  });
  it("costo de producción = solo ítems con costo cargado", () => {
    expect(s.kpis.productionCost).toBe(200); // 100 * 2 (Corona)
  });
  it("margen y % correctos", () => {
    expect(s.kpis.margin).toBe(600);
    expect(s.kpis.marginPct).toBe(75); // 600/800
  });
  it("cuenta ítems sin costo cargado", () => {
    expect(s.kpis.itemsTotal).toBe(3);
    expect(s.kpis.itemsWithoutCost).toBe(2); // Puente (costo 0) + item sin catálogo
  });
  it("cuenta facturas", () => {
    expect(s.kpis.invoiceCount).toBe(2);
  });
});

describe("buildProfitabilitySummary — por tipo de trabajo", () => {
  const s = buildProfitabilitySummary(invoices, items, costMap, NOW);

  it("agrupa por nombre de catálogo e incluye extras en el ingreso", () => {
    const corona = s.byWorkType.find((w) => w.label === "Corona");
    const puente = s.byWorkType.find((w) => w.label === "Puente");
    expect(corona).toMatchObject({ revenue: 400, cost: 200, margin: 200, qty: 2, marginPct: 50 });
    expect(puente).toMatchObject({ revenue: 150, cost: 0, margin: 150, qty: 1, marginPct: 100 });
  });

  it("ordena por margen descendente", () => {
    const margins = s.byWorkType.map((w) => w.margin);
    const sorted = [...margins].sort((a, b) => b - a);
    expect(margins).toEqual(sorted);
    // El ítem sin catálogo ($300, costo 0) tiene el mayor margen (300),
    // por encima de Corona (200) y Puente (150).
    expect(s.byWorkType[0].margin).toBe(300);
    expect(s.byWorkType[0].cost).toBe(0);
  });

  it("crea una fila por cada grupo (Corona, Puente, item sin catálogo)", () => {
    expect(s.byWorkType).toHaveLength(3);
  });
});

describe("buildProfitabilitySummary — mensual", () => {
  const s = buildProfitabilitySummary(invoices, items, costMap, NOW);

  it("siembra exactamente monthsWindow meses", () => {
    expect(s.byMonth).toHaveLength(6);
    expect(s.monthsWindow).toBe(6);
  });
  it("imputa facturado y costo al mes correcto", () => {
    const jul = s.byMonth.find((m) => m.month === "Jul '26");
    const jun = s.byMonth.find((m) => m.month === "Jun '26");
    expect(jul).toMatchObject({ revenue: 500, cost: 200, margin: 300 });
    expect(jun).toMatchObject({ revenue: 300, cost: 0, margin: 300 });
  });
});

describe("buildProfitabilitySummary — bordes", () => {
  it("sin datos → todo en cero, sin división por cero", () => {
    const s = buildProfitabilitySummary([], [], new Map(), NOW);
    expect(s.kpis.revenue).toBe(0);
    expect(s.kpis.margin).toBe(0);
    expect(s.kpis.marginPct).toBe(0); // no NaN ni Infinity
    expect(s.byWorkType).toEqual([]);
    expect(s.byMonth).toHaveLength(6);
  });

  it("margen negativo cuando el costo supera el ingreso", () => {
    const inv: ProfitInvoice[] = [{ total: 100, created_at: "2026-07-01", order_id: "x" }];
    const it: ProfitItem[] = [{ order_id: "x", quantity: 1, unit_price: 100, catalog_item_id: "cat-a" }];
    const cost = new Map<string, CatalogCost>([["cat-a", { name: "Corona", unit_cost: 300 }]]);
    const s = buildProfitabilitySummary(inv, it, cost, NOW);
    expect(s.kpis.productionCost).toBe(300);
    expect(s.kpis.margin).toBe(-200);
    expect(s.kpis.marginPct).toBe(-200);
  });

  it("ítem sin catálogo cuenta como sin costo y ingreso íntegro", () => {
    const inv: ProfitInvoice[] = [{ total: 300, created_at: "2026-07-01", order_id: "x" }];
    const it: ProfitItem[] = [{ order_id: "x", quantity: 1, unit_price: 300, catalog_item_id: null, work_type: "bridge" }];
    const s = buildProfitabilitySummary(inv, it, new Map(), NOW);
    expect(s.kpis.itemsWithoutCost).toBe(1);
    expect(s.kpis.productionCost).toBe(0);
  });
});
