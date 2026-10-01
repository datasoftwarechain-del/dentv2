"use client";

/**
 * Franja compacta: los tres pasos ya están en miniatura en el encabezado
 * de "01 · Diseño digital" y los detalles (formatos, plazos, pago) viven
 * en la FAQ. Acá solo hace falta el puente entre el catálogo y la
 * plataforma, no una sección de 600 px con números gigantes.
 */

import { motion } from "framer-motion";
import { HOW_IT_WORKS } from "@/content/landing";

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y border-border bg-card py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
          <div className="max-w-md">
            <p className="section-label mb-3">{HOW_IT_WORKS.eyebrow}</p>
            <h2 className="text-[#044c64] text-balance text-2xl font-bold tracking-[-.015em] sm:text-3xl sm:tracking-[-.018em]">
              {HOW_IT_WORKS.title}
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              {HOW_IT_WORKS.subtitle}
            </p>
          </div>

          <ol className="grid gap-5 sm:grid-cols-3 sm:gap-6">
            {HOW_IT_WORKS.steps.map((step, index) => (
              <motion.li
                key={step.number}
                className="flex gap-3 sm:flex-col sm:gap-3"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: index * 0.1, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-sm font-bold tabular-nums text-primary"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#044c64]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
