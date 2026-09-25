"use client";

import { motion } from "framer-motion";
import { HOW_IT_WORKS } from "@/content/landing";

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y border-border bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">{HOW_IT_WORKS.eyebrow}</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {HOW_IT_WORKS.title}
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            {HOW_IT_WORKS.subtitle}
          </p>
        </div>

        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="absolute left-0 right-0 hidden h-px bg-gradient-to-r from-transparent via-border/60 to-transparent md:block"
            style={{ top: "1.75rem" }}
            aria-hidden="true"
          />
          {HOW_IT_WORKS.steps.map((step, index) => (
            <motion.li
              key={step.number}
              className="relative"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.15, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="mb-4 text-4xl font-bold text-muted-foreground/30 lg:text-5xl">{step.number}</div>
              <h3 className="text-xl font-bold text-[#044c64]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
