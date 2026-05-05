"use client";

import { formatNumber } from "@/lib/date-utils";
import { formatWorkType } from "@/lib/work-types";
import { computeItemTotal } from "@/lib/invoice-totals";

interface Extra {
  name: string;
  price: number;
  qty?: number;
}

interface InvoiceItemRowProps {
  item: {
    id: string;
    work_type: string;
    unit_price: number | null;
    quantity: number;
    selected_extras: Extra[];
    catalog_item: { name: string; base_price: number } | null;
  };
  /**
   * true → factura nueva (totals_strict). Línea principal muestra
   * basePrice × cantidad (sin extras) y el "Subtotal ítem" muestra el
   * total con extras. Esto coincide con el render del PDF y evita la
   * doble lectura del subtotal cuando el ítem tiene extras.
   * false (default) → factura histórica, render legacy: solo basePrice
   * en línea principal y subtotal solo cuando hay extras.
   */
  strictMode?: boolean;
}

export function InvoiceItemRow({ item, strictMode = false }: InvoiceItemRowProps) {
  const itemName = item.catalog_item?.name || formatWorkType(item.work_type);
  const basePrice = item.unit_price ?? item.catalog_item?.base_price ?? 0;
  const extras: Extra[] = Array.isArray(item.selected_extras) ? item.selected_extras : [];
  const extrasTotal = extras.reduce((sum, e) => sum + e.price * (e.qty ?? 1), 0);
  const qty = Number(item.quantity) || 1;
  const itemTotal = strictMode
    ? computeItemTotal(item)
    : (item.unit_price ?? basePrice + extrasTotal);
  const showQtyBadge = qty > 1;

  // En strict: línea principal = basePrice × cantidad (sin extras). Los
  // extras se suman aparte y el "Subtotal ítem" muestra el total. Antes
  // se renderizaba itemTotal acá, lo que duplicaba la suma cuando había
  // extras y desalineaba con el PDF.
  const mainLineAmount = strictMode ? basePrice * qty : basePrice;

  return (
    <div className="bg-white px-5 py-4 space-y-2">
      {/* Fila principal: nombre + precio */}
      <div className="flex justify-between items-baseline gap-4">
        <span className="font-bold text-[#044c64] text-sm">
          {itemName}{showQtyBadge ? ` ×${qty}` : ""}
        </span>
        <span className="font-semibold text-[#044c64] text-sm tabular-nums shrink-0">
          ${formatNumber(mainLineAmount)}
        </span>
      </div>

      {/* Extras — siempre visibles si existen */}
      {extras.length > 0 && (
        <div className="space-y-1 border-l-2 border-[#43eada]/40 pl-4 ml-1">
          {extras.map((extra, i) => {
            const extraQty = extra.qty ?? 1;
            const extraTotal = extra.price * extraQty;
            return (
              <div key={i} className="flex justify-between items-baseline gap-4">
                <span className="text-xs text-slate-500">
                  + {extra.name}{extraQty > 1 ? ` ×${extraQty}` : ""}
                </span>
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                  ${formatNumber(extraTotal)}
                </span>
              </div>
            );
          })}
          {/* Subtotal del ítem cuando hay extras (ambos modos) */}
          <div className="flex justify-between items-baseline gap-4 pt-1 border-t border-[#b0dde0]/30">
            <span className="text-xs font-semibold text-[#044c64]">Subtotal ítem</span>
            <span className="text-xs font-semibold text-[#044c64] tabular-nums shrink-0">
              ${formatNumber(strictMode ? itemTotal : basePrice + extrasTotal)}
            </span>
          </div>
        </div>
      )}

      {/* En strict sin extras pero con qty > 1, mostrar subtotal explícito */}
      {strictMode && extras.length === 0 && showQtyBadge && (
        <div className="flex justify-between items-baseline gap-4 pt-1 border-t border-[#b0dde0]/30">
          <span className="text-xs font-semibold text-[#044c64]">Subtotal ítem</span>
          <span className="text-xs font-semibold text-[#044c64] tabular-nums shrink-0">
            ${formatNumber(itemTotal)}
          </span>
        </div>
      )}
    </div>
  );
}
