import { describe, it, expect } from "vitest";
import {
  median,
  turnaroundHours,
  deliveryHours,
  onTimeRate,
  needsInfoRate,
  revisionsPerOrder,
  breakdownByService,
  breakdownByDesigner,
  studioTotals,
  type MetricOrderRow,
} from "@/lib/design/metrics";

const HOUR = 3_600_000;
const T0 = new Date("2026-09-01T09:00:00Z").getTime();
const at = (hoursFromT0: number) => new Date(T0 + hoursFromT0 * HOUR).toISOString();

function order(over: Partial<MetricOrderRow> = {}): MetricOrderRow {
  return {
    id: over.id ?? `o-${Math.random()}`,
    status: "delivered",
    submitted_at: at(0),
    first_delivery_at: at(24),
    approved_at: at(30),
    delivered_at: at(31),
    due_at: at(48),
    revision_count: 0,
    assigned_to: null,
    items: [{ service_code: "crown_bridge", quantity: 1, unit_price: 100, unit_cost: 30 }],
    ...over,
  };
}

describe("mediana", () => {
  it("con cantidad impar toma el del medio", () => {
    expect(median([10, 1, 5])).toBe(5);
  });

  it("con cantidad par promedia los dos centrales", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("un caso olvidado no arrastra la mediana como sí arrastraría el promedio", () => {
    const values = [20, 22, 24, 26, 500];
    expect(median(values)).toBe(24);
    // El promedio daría 118: no describe a ningún caso real de la serie.
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg).toBeGreaterThan(100);
  });

  it("sin datos da 0 y no rompe", () => {
    expect(median([])).toBe(0);
  });
});

describe("turnaround", () => {
  it("mide de envío a PRIMERA entrega, no a la entrega final", () => {
    const m = turnaroundHours([
      order({ submitted_at: at(0), first_delivery_at: at(20) }),
      order({ submitted_at: at(0), first_delivery_at: at(30) }),
    ]);
    expect(m.value).toBe(25);
    expect(m.sample).toBe(2);
  });

  it("ignora las que todavía no se entregaron, sin contarlas en la muestra", () => {
    const m = turnaroundHours([
      order({ submitted_at: at(0), first_delivery_at: at(10) }),
      order({ submitted_at: at(0), first_delivery_at: null }),
    ]);
    expect(m.value).toBe(10);
    expect(m.sample).toBe(1);
  });

  it("sin datos devuelve muestra 0 en vez de un número inventado", () => {
    expect(turnaroundHours([])).toEqual({ value: 0, sample: 0 });
    expect(turnaroundHours([order({ submitted_at: null })])).toEqual({ value: 0, sample: 0 });
  });

  it("descarta fechas al revés en vez de devolver horas negativas", () => {
    const m = turnaroundHours([order({ submitted_at: at(50), first_delivery_at: at(10) })]);
    expect(m.sample).toBe(0);
  });

  it("la entrega mide de aprobación a liberación", () => {
    const m = deliveryHours([order({ approved_at: at(30), delivered_at: at(34) })]);
    expect(m.value).toBe(4);
  });
});

describe("puntualidad", () => {
  it("el reloj del estudio se detiene en la primera entrega", () => {
    // Entregó a las 24 h con plazo de 48: puntual, aunque el cliente
    // haya tardado en aprobar y la entrega final sea muy posterior.
    const m = onTimeRate([
      order({ first_delivery_at: at(24), due_at: at(48), delivered_at: at(200) }),
    ]);
    expect(m.value).toBe(100);
  });

  it("entregar justo en el plazo cuenta como puntual", () => {
    expect(onTimeRate([order({ first_delivery_at: at(48), due_at: at(48) })]).value).toBe(100);
  });

  it("una tarde sobre dos da 50%", () => {
    const m = onTimeRate([
      order({ first_delivery_at: at(24), due_at: at(48) }),
      order({ first_delivery_at: at(72), due_at: at(48) }),
    ]);
    expect(m.value).toBe(50);
    expect(m.sample).toBe(2);
  });

  it("las órdenes sin plazo comprometido no entran en la cuenta", () => {
    const m = onTimeRate([
      order({ due_at: null }),
      order({ first_delivery_at: at(24), due_at: at(48) }),
    ]);
    expect(m.sample).toBe(1);
  });
});

describe("tasa de faltantes de datos", () => {
  it("cuenta las órdenes que pasaron por needs_info, aunque ya hayan salido", () => {
    const orders = [
      order({ id: "a" }),
      order({ id: "b" }),
      order({ id: "c" }),
      order({ id: "d" }),
    ];
    const m = needsInfoRate(orders, new Set(["a"]));
    expect(m.value).toBe(25);
    expect(m.sample).toBe(4);
  });

  it("las que nunca se enviaron no cuentan: no tuvieron oportunidad de fallar", () => {
    const m = needsInfoRate(
      [order({ id: "a", submitted_at: null }), order({ id: "b" })],
      new Set(["b"]),
    );
    expect(m.value).toBe(100);
    expect(m.sample).toBe(1);
  });

  it("sin órdenes enviadas no inventa un 0%", () => {
    expect(needsInfoRate([], new Set())).toEqual({ value: 0, sample: 0 });
  });
});

describe("revisiones por orden", () => {
  it("promedia solo sobre lo que llegó a entregarse", () => {
    const m = revisionsPerOrder([
      order({ revision_count: 2 }),
      order({ revision_count: 1 }),
      order({ revision_count: 5, first_delivery_at: null }), // todavía sin entregar
    ]);
    expect(m.value).toBe(1.5);
    expect(m.sample).toBe(2);
  });
});

describe("desglose por servicio", () => {
  it("suma ingreso, costo y margen, y ordena por ingreso", () => {
    const rows = breakdownByService([
      order({
        items: [
          { service_code: "crown_bridge", quantity: 2, unit_price: 100, unit_cost: 30 },
          { service_code: "all_on_x", quantity: 1, unit_price: 500, unit_cost: 200 },
        ],
      }),
    ]);
    expect(rows[0].serviceCode).toBe("all_on_x");
    expect(rows[0].revenue).toBe(500);
    expect(rows[0].margin).toBe(300);
    expect(rows[1].serviceCode).toBe("crown_bridge");
    expect(rows[1].revenue).toBe(200);
    expect(rows[1].margin).toBe(140);
  });

  it("una orden con dos líneas del mismo servicio cuenta como UNA orden", () => {
    const rows = breakdownByService([
      order({
        items: [
          { service_code: "crown_bridge", quantity: 1, unit_price: 100, unit_cost: 0 },
          { service_code: "crown_bridge", quantity: 3, unit_price: 100, unit_cost: 0 },
        ],
      }),
    ]);
    expect(rows[0].orders).toBe(1);
    expect(rows[0].units).toBe(4);
  });

  it("marca cuántas líneas no tienen costo, para no confiar de más en el margen", () => {
    const rows = breakdownByService([
      order({ items: [{ service_code: "crown_bridge", quantity: 1, unit_price: 100, unit_cost: null }] }),
    ]);
    expect(rows[0].margin).toBe(100);
    expect(rows[0].itemsWithoutCost).toBe(1);
  });

  it("usa la etiqueta legible del catálogo", () => {
    const rows = breakdownByService([order()]);
    expect(rows[0].label).toContain("Corona");
  });
});

describe("desglose por diseñador", () => {
  it("no reparte entre nadie las órdenes sin asignar", () => {
    const rows = breakdownByDesigner([
      order({ assigned_to: "u1" }),
      order({ assigned_to: null }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].orders).toBe(1);
  });

  it("acumula ingreso, margen y mediana de turnaround por persona", () => {
    const rows = breakdownByDesigner([
      order({
        assigned_to: "u1",
        submitted_at: at(0), first_delivery_at: at(10),
        revision_count: 2,
        items: [{ service_code: "crown_bridge", quantity: 2, unit_price: 100, unit_cost: 30 }],
      }),
      order({
        assigned_to: "u1",
        submitted_at: at(0), first_delivery_at: at(20),
        revision_count: 0,
        items: [{ service_code: "crown_bridge", quantity: 1, unit_price: 100, unit_cost: 30 }],
      }),
    ]);
    expect(rows[0].orders).toBe(2);
    expect(rows[0].revenue).toBe(300);
    expect(rows[0].margin).toBe(210);
    expect(rows[0].medianTurnaroundHours).toBe(15);
    expect(rows[0].avgRevisions).toBe(1);
  });
});

describe("totales del estudio", () => {
  it("separa lo facturado en cargos por revisión del resto", () => {
    const t = studioTotals([
      order({
        items: [
          { service_code: "crown_bridge", quantity: 1, unit_price: 1000, unit_cost: 300 },
          { service_code: "revision_fee", quantity: 1, unit_price: 150, unit_cost: 0, is_revision_fee: true },
        ],
      }),
    ]);
    expect(t.revenue).toBe(1150);
    expect(t.cost).toBe(300);
    expect(t.margin).toBe(850);
    // Lo que el ida y vuelta le costó al cliente, visible por separado.
    expect(t.revisionRevenue).toBe(150);
    expect(t.orders).toBe(1);
  });

  it("sin órdenes da todo en cero sin romper", () => {
    expect(studioTotals([])).toEqual({
      revenue: 0, cost: 0, margin: 0, revisionRevenue: 0, orders: 0,
    });
  });

  it("redondea a 2 decimales en vez de arrastrar flotantes", () => {
    const t = studioTotals([
      order({ items: [{ service_code: "crown_bridge", quantity: 3, unit_price: 33.33, unit_cost: 0 }] }),
    ]);
    expect(t.revenue).toBe(99.99);
  });
});
