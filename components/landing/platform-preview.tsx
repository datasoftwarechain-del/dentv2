"use client";

/**
 * Vista previa de la plataforma: un tablero Kanban y una factura, hechos
 * con HTML sobre las columnas REALES del producto (lib/order-status.ts),
 * con datos de muestra. Es una ilustración del producto, no una captura
 * retocada ni una promesa: cada cosa que se ve existe en el dashboard.
 *
 * Cuando haya una captura real con datos anonimizados, este componente
 * se reemplaza por un <Image> con el mismo marco; el layout no cambia.
 */

import { motion } from "framer-motion";
import { FileText, Paperclip } from "lucide-react";
import { PLATFORM } from "@/content/landing";
import { cn } from "@/lib/utils";

const COLUMN_DOT = ["bg-[#4b8899]", "bg-[#09919b]", "bg-[#044c64]", "bg-emerald-600"];

export function PlatformPreview() {
  const { columns, cards, invoice, caption } = PLATFORM.preview;
  return (
    <figure className="relative min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_-20px_rgba(4,76,100,.25)]"
        aria-label="Vista previa del tablero de producción"
      >
        {/* Barra de ventana */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden="true" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">Tablero de producción</span>
        </div>

        {/* Kanban. En mobile el tablero se desplaza a lo ancho, como en el
            producto: cuatro columnas de 130 px legibles, no cuatro de 80. */}
        <div className="overflow-x-auto [scrollbar-width:thin]">
        <div className="grid min-w-[560px] grid-cols-4 gap-2 p-3 sm:min-w-0 sm:gap-3 sm:p-4">
          {columns.map((col, ci) => (
            <div key={col} className="min-w-0 rounded-xl bg-muted/50 p-2">
              <div className="mb-2 flex items-center gap-1.5 px-1">
                <span className={cn("h-2 w-2 flex-none rounded-full", COLUMN_DOT[ci])} aria-hidden="true" />
                <span className="truncate text-[11px] font-semibold text-foreground sm:text-xs">{col}</span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.filter((c) => c.column === ci).map((c, i) => (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 + ci * 0.08 + i * 0.06, duration: 0.4 }}
                    className="rounded-lg border border-border/70 bg-background p-2 shadow-sm"
                  >
                    <p className="truncate text-[11px] font-semibold leading-snug text-foreground sm:text-xs">{c.title}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">{c.client}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium text-primary sm:text-[10px]">
                      {ci === 0 && <Paperclip className="h-2.5 w-2.5" aria-hidden="true" />}
                      {c.tag}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
        </div>
      </motion.div>

      {/* Factura, superpuesta: "cada orden cerrada genera su factura". */}
      <motion.div
        initial={{ opacity: 0, y: 16, x: 8 }}
        whileInView={{ opacity: 1, y: 0, x: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ delay: 0.55, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="ml-auto mt-3 flex w-fit items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 shadow-[0_18px_40px_-16px_rgba(4,76,100,.35)] sm:absolute sm:-right-4 sm:bottom-6 sm:mt-0"
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[11px] text-muted-foreground">{invoice.label}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {invoice.number} · {invoice.total}
          </span>
        </span>
      </motion.div>

      <figcaption className="mt-4 text-center text-xs text-muted-foreground/80 sm:mt-9 lg:text-left">{caption}</figcaption>
    </figure>
  );
}
