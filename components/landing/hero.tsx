"use client";

/**
 * Hero de dos caminos. Un titular de resultado y dos CTAs que dicen a
 * dónde van: pedir un diseño (paga hoy) o probar la plataforma (gratis).
 * El tercero, en texto, es para quien está en Uruguay y quiere pieza física.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { HERO } from "@/content/landing";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent to-primary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.187rem]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p {...fadeUp(0)} className="section-label mb-5">
            {HERO.kicker}
          </motion.p>

          <motion.h1
            {...fadeUp(0.1)}
            className="text-[#044c64] text-balance text-4xl font-bold tracking-tight leading-[1.08] sm:text-5xl lg:text-6xl"
          >
            {HERO.title[0]}
            <br />
            <span className="text-primary">{HERO.title[1]}</span>
          </motion.h1>

          <motion.p {...fadeUp(0.2)} className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {HERO.subtitle}
          </motion.p>

          <motion.div {...fadeUp(0.32)} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="premium-transition w-full gap-2 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto">
              <Link href={HERO.primary.href}>
                {HERO.primary.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="premium-transition w-full hover:bg-accent/10 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto">
              <Link href={HERO.secondary.href}>{HERO.secondary.label}</Link>
            </Button>
          </motion.div>

          <motion.p {...fadeUp(0.4)} className="mt-4 text-sm">
            <Link href={HERO.tertiary.href} className="focus-ring rounded-sm text-primary underline-offset-4 hover:underline">
              {HERO.tertiary.label}
            </Link>
          </motion.p>

          <motion.ul {...fadeUp(0.48)} className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground/80">
            {HERO.trust.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
