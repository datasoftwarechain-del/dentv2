"use client";

/**
 * Lista compacta del catálogo de diseño, bajo el coverflow y sobre la
 * misma franja oscura. El coverflow es vitrina: muestra una card legible
 * a la vez y recorrer las doce cuesta once clics. Esta lista es para
 * elegir: las doce, agrupadas por la categoría real del catálogo
 * (lib/design/services.ts), con plazo y precio, cada fila un enlace al
 * flujo de solicitud con el servicio preseleccionado.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupServicesByCategory } from "@/lib/design/services";
import { DESIGN_LIST, type ServiceCardContent } from "@/content/servicios";

interface DesignCatalogListProps {
  items: ServiceCardContent[];
  prices: Record<string, string | null>;
}

export function DesignCatalogList({ items, prices }: DesignCatalogListProps) {
  // En mobile la lista mide una pantalla entera: va plegada tras un botón.
  // En desktop siempre abierta (cuatro columnas, 200 px).
  const [open, setOpen] = useState(false);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const groups = groupServicesByCategory()
    .map((g) => ({ ...g, cards: g.services.map((s) => byKey.get(s.code)).filter((c): c is ServiceCardContent => Boolean(c)) }))
    .filter((g) => g.cards.length > 0);

  return (
    <nav aria-label={DESIGN_LIST.title} className="mt-12 border-t border-[rgba(219,245,246,.14)] pt-8 lg:mt-14 lg:pt-10">
      <div className="hidden flex-col gap-1 lg:flex lg:flex-row lg:items-baseline lg:justify-between lg:gap-6">
        <h4 className="m-0 text-[17px] font-medium text-white lg:text-[20px]">{DESIGN_LIST.title}</h4>
        <p className="m-0 text-[12.5px] text-[#a9c6cf]">{DESIGN_LIST.hint}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="design-catalog-list"
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-2xl border border-[rgba(219,245,246,.18)] bg-[rgba(219,245,246,.06)] px-4 py-3 text-left lg:hidden"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium text-white">{DESIGN_LIST.title}</span>
          <span className="text-[12px] text-[#a9c6cf]">{DESIGN_LIST.hint}</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 flex-none text-[#90ecdc] transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      <div id="design-catalog-list" className={cn("mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4", open ? "grid" : "hidden lg:grid")}>
        {groups.map((g) => (
          <div key={g.category}>
            <h5 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#90ecdc]">{g.label}</h5>
            <ul className="m-0 flex list-none flex-col p-0">
              {g.cards.map((c) => {
                const price = prices[c.key] ?? null;
                return (
                  <li key={c.key} className="border-t border-[rgba(219,245,246,.1)] first:border-t-0">
                    <Link
                      href={c.href}
                      className="focus-ring group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-[rgba(219,245,246,.07)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium leading-snug text-[#dbf5f6] group-hover:text-white">{c.title}</span>
                        <span className="block text-[11.5px] tabular-nums text-[#7ea6ba]">
                          {c.time}
                          {price && <> · {price}</>}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 flex-none text-[#7ea6ba] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
