"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const itemName = item.catalog_item?.name || formatWorkType(item.work_type);
  const basePrice = item.catalog_item?.base_price ?? 0;
  const extras: Extra[] = Array.isArray(item.selected_extras) ? item.selected_extras : [];
  const hasExtras = extras.length > 0;
  const qty = item.quantity > 1 ? item.quantity : null;

  return (
    <>
      {/* Fila principal */}
      <div className="bg-white px-5 py-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            {/* Nombre + botón expandir si hay extras */}
            {hasExtras ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-left group"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#09919b] shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[#09919b] shrink-0" />
                )}
                <span className="font-bold text-[#044c64] text-sm group-hover:text-[#09919b] transition-colors">
                  {itemName}{qty ? ` ×${qty}` : ""}
                </span>
                <span className="text-[10px] text-[#09919b] font-medium ml-1">
                  +{extras.length} extra{extras.length > 1 ? "s" : ""}
                </span>
              </button>
            ) : (
              <span className="font-bold text-[#044c64] text-sm">
                {itemName}{qty ? ` ×${qty}` : ""}
              </span>
            )}
          </div>
          <span className="font-semibold text-[#044c64] text-sm tabular-nums shrink-0">
            ${formatNumber(basePrice)}
          </span>
        </div>

        {/* Extras expandidos */}
        {expanded && (
          <div className="mt-2 space-y-1.5 border-l-2 border-[#43eada]/40 pl-4 ml-1">
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
          </div>
        )}

        {/* Extras siempre visibles (modo no expandible — fallback sin interacción) */}
        {!hasExtras && null}
      </div>
    </>
  );
}
