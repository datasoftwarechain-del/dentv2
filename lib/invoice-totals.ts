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
  catalog_item: { base_price: number; is_passthrough?: boolean } | null;
}

/**
 * Total de un ítem = (precio base + suma de extras × qty_extra) × cantidad.
 * unit_price es la fuente preferida; cae a catalog_item.base_price.
 *
 * IMPORTANTE: Esta función tiene contraparte SQL en
 * scripts/026b_invoice_lifecycle_safe.sql (función auto_generate_invoice).
 * Cualquier cambio en la fórmula DEBE replicarse allá para mantener paridad.
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

/**
 * [034_passthrough_items] Porción del total que corresponde a aranceles
 * tercerizados (price_catalog.is_passthrough). Es "facturación muerta":
 * se le cobra al cliente, pero el laboratorio no gana nada porque el
 * costo es el 100% del precio.
 *
 * Se usa para descontarla de las métricas de gestión. NO se resta de
 * invoices.total ni del saldo del cliente — la factura no cambia.
 */
export function computePassthroughTotal(
  items: InvoiceItemForTotals[] | null | undefined,
): number {
  if (!Array.isArray(items)) return 0;
  const sum = items.reduce(
    (acc, it) => (it.catalog_item?.is_passthrough ? acc + computeItemTotal(it) : acc),
    0,
  );
  return round2(sum);
}

/**
 * [034_passthrough_items] Neto de gestión de una factura: su total
 * persistido menos la parte tercerizada de sus ítems.
 *
 * Usa el `total` real de la factura (no la suma de ítems) para no
 * arrastrar el drift de facturas editadas a mano, y le resta solo la
 * porción tercerizada. Nunca devuelve negativo.
 */
export function computeInvoiceNetOfPassthrough(
  invoiceTotal: number,
  items: InvoiceItemForTotals[] | null | undefined,
): number {
  const net = Number(invoiceTotal ?? 0) - computePassthroughTotal(items);
  return round2(Math.max(0, net));
}
