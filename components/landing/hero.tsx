"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Background radial gradient for depth */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent to-primary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.187rem]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">

          <motion.div {...fadeUp(0)} className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-accent" style={{ animationName: "pulse", animationDuration: "3s", animationIterationCount: "infinite" }} />
            <span className="text-muted-foreground">
              <span aria-hidden="true">🦷 </span>
              Plataforma líder en gestión dental
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="text-premium-gradient text-balance text-4xl font-bold tracking-tight leading-[1.1] sm:text-5xl lg:text-6xl"
          >
            Tu clínica dental merece dejar el caos atrás, hoy.
          </motion.h1>

          <motion.p {...fadeUp(0.2)} className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Gestiona turnos, historia clínica, pedidos digitales y facturación en una sola plataforma.
            Conecta tu clínica con laboratorios y toma el control sin WhatsApp ni papeles.
          </motion.p>

          <motion.div {...fadeUp(0.32)} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="premium-transition gap-2 hover:-translate-y-0.5 active:translate-y-0">
                Comenzar Gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="lg" className="premium-transition hover:bg-accent/10 hover:-translate-y-0.5 active:translate-y-0">
                Ver Demo
              </Button>
            </Link>
          </motion.div>

          <motion.p {...fadeUp(0.42)} className="mt-6 text-sm text-muted-foreground/60">
            Sin tarjeta de crédito · Activación inmediata · Soporte humano incluido
          </motion.p>

        </div>
      </div>
    </section>
  );
}
