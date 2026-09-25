"use client";

/**
 * "La plataforma": cuatro beneficios, no seis módulos. Nadie compra un
 * módulo; compra dejar de perseguir trabajos por WhatsApp.
 */

import { ClipboardCheck, KanbanSquare, Receipt, Users, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { PLATFORM } from "@/content/landing";

const ICONS: Record<string, LucideIcon> = { ClipboardCheck, KanbanSquare, Receipt, Users };

export function Features() {
  return (
    <section id="plataforma" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">{PLATFORM.eyebrow}</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {PLATFORM.title}
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            {PLATFORM.subtitle}
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {PLATFORM.benefits.map((b, index) => {
            const Icon = ICONS[b.icon] ?? ClipboardCheck;
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: index * 0.1, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <Card className="glass-card h-full border-none bg-card/40">
                  <CardHeader className="gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
                      <Icon className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-lg font-semibold leading-snug">{b.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{b.text}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
