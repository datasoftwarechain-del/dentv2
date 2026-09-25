/**
 * Resumen breve de lo que incluye una factura, para listados: los ítems
 * de la orden con su cantidad y sus adicionales, en una línea.
 *
 *   "Prótesis completa ×2 (+ Reborde) · Cubeta · Tablillas"
 *
 * El nombre sale del catálogo (catalog_item.name); si el ítem no tiene
 * arancel, del work_type. Los adicionales son los `selected_extras` del
 * ítem (JSONB en lab_order_items). Sin ítems, cae al work_type de la
 * factura; sin nada, cadena vacía y el listado no muestra la línea.
 */

import { formatWorkType } from "@/lib/work-types";

export interface SummarizableItem {
  catalog_item?: { name: string } | null;
  work_type?: string | null;
  quantity?: number | null;
  selected_extras?: ReadonlyArray<{ name: string; qty?: number }> | null;
}

export function summarizeInvoiceItems(
  items: ReadonlyArray<SummarizableItem> | null | undefined,
  fallbackWorkType?: string | null,
): string {
  const parts = (items ?? [])
    .map((item) => {
      const name = item.catalog_item?.name?.trim() || (item.work_type ? formatWorkType(item.work_type) : "");
      if (!name) return "";
      const qty = Number(item.quantity) || 1;
      const extras = (Array.isArray(item.selected_extras) ? item.selected_extras : [])
        .map((e) => {
          const n = String(e?.name ?? "").trim();
          if (!n) return "";
          const q = Number(e.qty) || 1;
          return q > 1 ? `${n} ×${q}` : n;
        })
        .filter(Boolean);
      return `${name}${qty > 1 ? ` ×${qty}` : ""}${extras.length ? ` (+ ${extras.join(", ")})` : ""}`;
    })
    .filter(Boolean);

  if (parts.length > 0) return parts.join(" · ");
  return fallbackWorkType ? formatWorkType(fallbackWorkType) : "";
}
