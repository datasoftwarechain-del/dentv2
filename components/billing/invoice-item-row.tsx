"use client";

import { formatNumber } from "@/lib/date-utils";
import { formatWorkType } from "@/lib/work-types";

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
}

export function InvoiceItemRow({ item }: InvoiceItemRowProps) {
  const itemName = item.catalog_item?.name || formatWorkType(item.work_type);
  const basePrice = item.catalog_item?.base_price ?? 0;
  const extras: Extra[] = Array.isArray(item.selected_extras) ? item.selected_extras : [];
  const extrasTotal = extras.reduce((sum, e) => sum + e.price * (e.qty ?? 1), 0);
  const totalPrice = item.unit_price ?? (basePrice + extrasTotal);
  const qty = item.quantity > 1 ? item.quantity : null;

  return (
    <div className="bg-white px-5 py-4 space-y-2">
      {/* Fila principal: nombre + precio total */}
      <div className="flex justify-between items-baseline gap-4">
        <span className="font-bold text-[#044c64] text-sm">
          {itemName}{qty ? ` ×${qty}` : ""}
        </span>
        <span className="font-semibold text-[#044c64] text-sm tabular-nums shrink-0">
          ${formatNumber(basePrice)}
        </span>
      </div>

      {/* Extras — siempre visibles */}
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
          {/* Subtotal del ítem si hay extras */}
          <div className="flex justify-between items-baseline gap-4 pt-1 border-t border-[#b0dde0]/30">
            <span className="text-xs font-semibold text-[#044c64]">Subtotal ítem</span>
            <span className="text-xs font-semibold text-[#044c64] tabular-nums shrink-0">
              ${formatNumber(totalPrice)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
