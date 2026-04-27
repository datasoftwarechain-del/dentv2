/**
 * Helpers puros para cálculo de totales de facturas/items.
 * Solo aplican cuando la factura tiene totals_strict = true (creadas por
 * el código actualizado o por el trigger auto_generate_invoice). Las
 * facturas con totals_strict = false (históricas) usan los montos
 * persistidos verbatim — no llamar a estos helpers para esas.
 */

export interface InvoiceItemExtra {
  name: string;
  price: number;
  qty?: number;
}

export interface InvoiceItemForTotals {
  unit_price: number | null;
  quantity: number;
  selected_extras: InvoiceItemExtra[] | null | undefined;
  catalog_item: { base_price: number } | null;
}

/**
 * Total de un ítem = (precio base + suma de extras × qty_extra) × cantidad.
 * unit_price es la fuente preferida; cae a catalog_item.base_price.
 */
export function computeItemTotal(item: InvoiceItemForTotals): number {
  const basePrice = item.unit_price ?? item.catalog_item?.base_price ?? 0;
  const extras = Array.isArray(item.selected_extras) ? item.selected_extras : [];
  const extrasTotal = extras.reduce(
    (sum, e) => sum + Number(e.price) * (e.qty ?? 1),
    0,
  );
  const qty = Number(item.quantity) || 1;
  return (Number(basePrice) + extrasTotal) * qty;
}

/**
 * Suma todos los items + IVA según taxRate (0 si no hay).
 * Devuelve { subtotal, taxAmount, total } redondeados a 2 decimales.
 */
export function computeInvoiceTotals(
  items: InvoiceItemForTotals[],
  taxRate: number = 0,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, it) => sum + computeItemTotal(it), 0);
  const taxAmount = taxRate > 0 ? (subtotal * taxRate) / 100 : 0;
  const total = subtotal + taxAmount;
  return {
    subtotal: round2(subtotal),
    taxAmount: round2(taxAmount),
    total: round2(total),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
