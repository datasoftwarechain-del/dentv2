/**
 * [035_design_studio] Totales de una orden de diseño.
 *
 * Misma convención que lib/invoice-totals.ts: el precio de la línea es
 * unit_price × cantidad + extras, y los extras NO se multiplican por la
 * cantidad de la línea salvo que traigan su propio qty. Replicar esa
 * regla acá evita el bug que ya se pagó una vez en producción física
 * (doblado de extras al crear la orden, commit 6c22140).
 *
 * El cálculo del trigger design_order_auto_invoice() en
 * scripts/035_design_studio.sql tiene que dar lo mismo que esto.
 */

import type { DesignExtra } from "./types";

export interface DesignItemForTotals {
  unit_price: number | null;
  quantity: number;
  unit_cost?: number | null;
  selected_extras: DesignExtra[] | null | undefined;
}

export function computeDesignExtrasTotal(extras: DesignExtra[] | null | undefined): number {
  if (!Array.isArray(extras)) return 0;
  return extras.reduce(
    (sum, e) => sum + Number(e?.price ?? 0) * Number(e?.qty ?? 1),
    0,
  );
}

export function computeDesignItemTotal(item: DesignItemForTotals): number {
  const qty = Number(item.quantity ?? 1);
  const base = Number(item.unit_price ?? 0) * qty;
  return round2(base + computeDesignExtrasTotal(item.selected_extras));
}

export interface DesignOrderTotals {
  subtotal: number;
  /** Costo imputado a los diseñadores. 0 si no se cargó unit_cost. */
  cost: number;
  /** subtotal − cost. Sin unit_cost cargado da igual al subtotal, no es margen real. */
  margin: number;
  /** Cuántas líneas todavía no tienen unit_cost: mide cuánto confiar en `margin`. */
  itemsWithoutCost: number;
}

export function computeDesignOrderTotals(
  items: DesignItemForTotals[] | null | undefined,
): DesignOrderTotals {
  const list = Array.isArray(items) ? items : [];

  let subtotal = 0;
  let cost = 0;
  let itemsWithoutCost = 0;

  for (const item of list) {
    subtotal += computeDesignItemTotal(item);

    const qty = Number(item.quantity ?? 1);
    const unitCost = Number(item.unit_cost ?? 0);
    if (!(unitCost > 0)) itemsWithoutCost++;
    cost += unitCost * qty;
  }

  subtotal = round2(subtotal);
  cost = round2(cost);

  return { subtotal, cost, margin: round2(subtotal - cost), itemsWithoutCost };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
