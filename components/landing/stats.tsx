"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicStats } from "@/lib/landing/public-stats";
import { STATS_LABELS } from "@/content/landing";
import { useInView } from "framer-motion";

interface StatValue {
  num: number;
  suffix: string;
  prefix: string;
}

function parseStat(value: string): StatValue {
  // "+550" → { num: 550, prefix: "+" } · "24–72 h" → no se anima
  const match = value.match(/^([^0-9]*)([0-9.]+)([^0-9]*)$/);
  if (!match) return { num: 0, suffix: value, prefix: "" };
  return {
    prefix: match[1] || "",
    num: parseFloat(match[2]),
    suffix: match[3] || "",
  };
}

function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState("0");
  const { num, suffix, prefix } = parseStat(value);
  const isDecimal = num % 1 !== 0;

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * num;
      setDisplay(isDecimal ? current.toFixed(1) : Math.floor(current).toString());
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [inView, num, isDecimal]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 px-4 sm:flex-row sm:gap-3">
      <p className="text-2xl font-bold tabular-nums tracking-[-.015em] text-primary sm:text-3xl sm:tracking-[-.018em]" aria-label={value}>
        {num > 0 ? `${prefix}${display}${suffix}` : value}
      </p>
      <p className="text-center text-sm leading-snug text-muted-foreground sm:text-left">{label}</p>
    </div>
  );
}

/**
 * Cifras REALES: vienen del servidor (lib/landing/public-stats.ts), no de
 * una constante. Si no hay datos, la sección no se renderiza.
 *
 * Va justo debajo de los tres caminos, como pie de esa misma franja: la
 * prueba antes del catálogo, no al 70 % de la página. Tres cifras, no
 * cuatro: "12 servicios" era un conteo del catálogo, no una prueba.
 */
export function Stats({ stats }: { stats: PublicStats | null }) {
  if (!stats) return null;
  const items = [
    { value: `+${stats.orders}`, label: STATS_LABELS.orders },
    { value: `+${stats.clinics}`, label: STATS_LABELS.clinics },
    { value: stats.turnaround, label: STATS_LABELS.turnaround },
  ];
  return (
    <section className="-mt-px border-b border-border bg-card" aria-label="Cifras">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-y-4 border-t border-border/70 py-6 sm:grid-cols-3 sm:divide-x sm:divide-border sm:py-7">
          {items.map((stat) => (
            <AnimatedStat key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
