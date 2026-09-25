"use client";

/**
 * Los tres caminos de la plataforma, justo debajo del hero: el visitante
 * se ubica en uno y salta a su sección o a su formulario.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PILLARS } from "@/content/landing";
import { ScopeChip } from "@/components/landing/servicios/scope-chip";

export function Pillars() {
  return (
    <section aria-label="Qué hacemos" className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
          {PILLARS.map((p, i) => (
            <motion.li
              key={p.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Link
                href={p.href}
                className="focus-ring group flex h-full flex-col gap-3 rounded-2xl border border-border bg-background p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_18px_44px_rgba(18,45,60,.10)]"
              >
                <ScopeChip scope={p.scope === "uruguay" ? "uruguay" : "worldwide"} size="sm" label={p.scope === "uruguay" ? "Uruguay" : "Online"} />
                <h2 className="text-lg font-semibold leading-snug text-[#044c64]">{p.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
                  {p.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
