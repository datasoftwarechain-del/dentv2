/**
 * Detalle de lo que incluye una factura, en una línea.
 *
 * Se ve en dos lados y por eso importa que no mienta: bajo cada factura del
 * estado de cuenta en pantalla, y —desde el 2026-10-02— en el PDF que se le
 * manda al cliente. Antes el PDF no lo llevaba.
 */

import { describe, it, expect } from "vitest";
import { summarizeInvoiceItems } from "@/lib/invoice-summary";

describe("summarizeInvoiceItems", () => {
  it("sin ítems y sin work_type devuelve cadena vacía, para que el listado no pinte la línea", () => {
    expect(summarizeInvoiceItems([], null)).toBe("");
    expect(summarizeInvoiceItems(null, null)).toBe("");
    expect(summarizeInvoiceItems(undefined, undefined)).toBe("");
  });

  it("sin ítems cae al work_type de la factura", () => {
    expect(summarizeInvoiceItems([], "corona_zirconia")).not.toBe("");
  });

  it("un ítem: sale el nombre del catálogo", () => {
    expect(summarizeInvoiceItems([{ catalog_item: { name: "Perno muñon" } }])).toBe("Perno muñon");
  });

  it("varios ítems van separados por ·", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Perno muñon" } },
      { catalog_item: { name: "Jacket Acrilica" } },
    ]);
    expect(r).toBe("Perno muñon · Jacket Acrilica");
  });

  it("la cantidad solo se muestra si es mayor a 1", () => {
    expect(summarizeInvoiceItems([{ catalog_item: { name: "Corona" }, quantity: 1 }])).toBe("Corona");
    expect(summarizeInvoiceItems([{ catalog_item: { name: "Corona" }, quantity: 3 }])).toBe("Corona ×3");
  });

  it("los adicionales van entre paréntesis", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Terminacion" }, selected_extras: [{ name: "Tablilla de dientes" }] },
    ]);
    expect(r).toBe("Terminacion (+ Tablilla de dientes)");
  });

  it("un adicional con cantidad > 1 la muestra", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Protesis" }, selected_extras: [{ name: "Reborde", qty: 2 }] },
    ]);
    expect(r).toBe("Protesis (+ Reborde ×2)");
  });

  it("varios adicionales van separados por coma", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Protesis" }, selected_extras: [{ name: "Reborde" }, { name: "Gancho" }] },
    ]);
    expect(r).toBe("Protesis (+ Reborde, Gancho)");
  });

  it("sin arancel usa el work_type del ítem", () => {
    const r = summarizeInvoiceItems([{ work_type: "corona_zirconia" }]);
    expect(r).not.toBe("");
    expect(r).not.toContain("corona_zirconia"); // formateado, no el enum crudo
  });

  it("un ítem sin nombre ni work_type se descarta y no deja basura", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Corona" } },
      { catalog_item: { name: "   " } },
      {},
    ]);
    expect(r).toBe("Corona");
  });

  it("un adicional con nombre vacío no agrega paréntesis huérfanos", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Corona" }, selected_extras: [{ name: "  " }] },
    ]);
    expect(r).toBe("Corona");
  });

  it("selected_extras que no es arreglo no rompe", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Corona" }, selected_extras: null },
    ]);
    expect(r).toBe("Corona");
  });

  it("el caso real de producción: ORDEN 383", () => {
    const r = summarizeInvoiceItems([
      { catalog_item: { name: "Perno muñon" }, quantity: 1 },
      { catalog_item: { name: "Jacket Acrilica" }, quantity: 1 },
    ]);
    expect(r).toBe("Perno muñon · Jacket Acrilica");
  });
});
