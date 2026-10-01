"use client";

/**
 * Los tres caminos de la plataforma, justo debajo del hero: el visitante
 * se ubica en uno y salta a su sección o a su formulario.
 *
 * Comparten el lenguaje visual de las cards de Servicios
 * (components/landing/servicios/service-card.tsx): mismo radio, misma
 * banda de media con trama, mismo chip de alcance encima, misma sombra y
 * el mismo CTA en píldora. La diferencia es que acá la card ENTERA es el
 * enlace — es un selector de camino, no una ficha de producto —, así que
 * el CTA es un <span> con aspecto de botón y no un <a> anidado.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
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
              className="h-full"
            >
              <Link
                href={p.href}
                className={[
                  "focus-ring group flex h-full flex-col rounded-[28px] bg-white p-2.5",
                  "border border-[rgba(32,80,104,.08)] shadow-[0_6px_18px_rgba(18,45,60,.08)]",
                  "transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(.4,0,.2,1)]",
                  "hover:-translate-y-1 hover:border-[rgba(32,80,104,.28)] hover:shadow-[0_18px_44px_rgba(18,45,60,.16)]",
                  "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                ].join(" ")}
              >
                {/* ─── Media ─────────────────────────────────────── */}
                <div
                  className={[
                    "relative h-[132px] flex-none overflow-hidden rounded-[20px]",
                    p.scope === "uruguay" ? "bg-[#edf4fb]" : "bg-[var(--dd-mist-100)]",
                  ].join(" ")}
                >
                  <div
                    aria-hidden="true"
                    className={[
                      "absolute inset-0 flex items-center justify-center pt-5 text-center",
                      "bg-[repeating-linear-gradient(135deg,rgba(32,80,104,.05)_0_8px,transparent_8px_16px)]",
                      "transition-transform duration-[360ms] ease-[cubic-bezier(.4,0,.2,1)]",
                      "group-hover:scale-[1.07] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                    ].join(" ")}
                  >
                    <span className="px-4 font-mono text-[10.5px] uppercase leading-[1.3] tracking-[.04em] text-[var(--dd-deep-400)]">
                      {p.placeholder}
                    </span>
                  </div>

                  <div className="absolute left-3 top-3">
                    <ScopeChip
                      scope={p.scope === "uruguay" ? "uruguay" : "worldwide"}
                      size="sm"
                      label={p.scope === "uruguay" ? "Uruguay" : "Online"}
                    />
                  </div>

                  <span
                    aria-hidden="true"
                    className={[
                      "absolute right-2.5 top-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full",
                      "bg-white text-[var(--dd-deep-600)] transition-colors duration-200",
                      "group-hover:bg-[var(--dd-deep-600)] group-hover:text-white",
                    ].join(" ")}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>

                {/* ─── Cuerpo ────────────────────────────────────── */}
                <div className="flex flex-1 flex-col justify-between gap-3.5 px-2 pb-1.5 pt-3.5">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="m-0 text-[17px] font-semibold leading-[1.2] tracking-[-.01em] text-[var(--dd-deep-800)] [text-wrap:pretty]">
                      {p.title}
                    </h2>
                    <p className="m-0 text-[13.5px] leading-[1.5] text-[var(--dd-neutral-700)] [text-wrap:pretty]">
                      {p.text}
                    </p>
                  </div>

                  <span
                    className={[
                      "inline-flex h-9 w-full items-center justify-center rounded-full text-[13px] font-medium",
                      "border border-[rgba(32,80,104,.16)] bg-white text-[var(--dd-deep-600)]",
                      "transition-colors duration-200 group-hover:bg-[var(--dd-mist-050)]",
                    ].join(" ")}
                  >
                    {p.cta}
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
