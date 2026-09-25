"use client";

/**
 * "La plataforma": el producto a la vista y cuatro beneficios al lado.
 * Nadie compra un módulo, compra dejar de perseguir trabajos por
 * WhatsApp; pero nadie paga US$ 49/mes por algo que no vio.
 */

import Link from "next/link";
import { ClipboardCheck, KanbanSquare, Receipt, Users, ArrowRight, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PLATFORM } from "@/content/landing";
import { PlatformPreview } from "@/components/landing/platform-preview";

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

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <PlatformPreview />

          <div>
            <ul className="flex flex-col gap-7">
              {PLATFORM.benefits.map((b, index) => {
                const Icon = ICONS[b.icon] ?? ClipboardCheck;
                return (
                  <motion.li
                    key={b.title}
                    className="flex gap-4"
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: index * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
                      <Icon className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold leading-snug text-foreground">{b.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
            <Button asChild variant="outline" className="premium-transition mt-8 gap-2 hover:bg-accent/10">
              <Link href={PLATFORM.cta.href}>
                {PLATFORM.cta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
