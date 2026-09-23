import { describe, it, expect } from "vitest";
import {
  computePassthroughTotal,
  computeInvoiceNetOfPassthrough,
  type InvoiceItemForTotals,
} from "@/lib/invoice-totals";

// [034_passthrough_items] Lo tercerizado sale de las métricas de gestión
// pero NUNCA del total que se le cobra al cliente.
const cromo: InvoiceItemForTotals = {
  unit_price: 4500, quantity: 1,
  selected_extras: [{ name: "Envios", price: 290, qty: 2 }],
  catalog_item: { base_price: 4500, is_passthrough: true },
};
const corona: InvoiceItemForTotals = {
  unit_price: 5200, quantity: 1, selected_extras: [],
  catalog_item: { base_price: 5200 },
};

describe("computePassthroughTotal", () => {
  it("suma base + extras del ítem tercerizado", () => {
    expect(computePassthroughTotal([cromo])).toBe(5080);
  });
  it("ignora los ítems no tercerizados", () => {
    expect(computePassthroughTotal([cromo, corona])).toBe(5080);
  });
  it("devuelve 0 sin tercerizados, sin ítems, o con entrada inválida", () => {
    expect(computePassthroughTotal([corona])).toBe(0);
    expect(computePassthroughTotal([])).toBe(0);
    expect(computePassthroughTotal(null)).toBe(0);
    expect(computePassthroughTotal(undefined)).toBe(0);
  });
  it("respeta la cantidad", () => {
    expect(computePassthroughTotal([{ ...cromo, quantity: 3 }])).toBe(15240);
  });
});

describe("computeInvoiceNetOfPassthrough", () => {
  it("resta la porción tercerizada del total persistido", () => {
    expect(computeInvoiceNetOfPassthrough(10280, [cromo, corona])).toBe(5200);
  });
  it("parte del total real de la factura, no de la suma de ítems (facturas con drift)", () => {
    // Factura editada a mano: total 6700, ítems suman 5080. El neto usa 6700.
    expect(computeInvoiceNetOfPassthrough(6700, [cromo])).toBe(1620);
  });
  it("nunca devuelve negativo", () => {
    expect(computeInvoiceNetOfPassthrough(1000, [cromo])).toBe(0);
  });
  it("sin tercerizados devuelve el total intacto", () => {
    expect(computeInvoiceNetOfPassthrough(5200, [corona])).toBe(5200);
  });
});
