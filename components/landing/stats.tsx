"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface StatValue {
  num: number;
  suffix: string;
  prefix: string;
}

function parseStat(value: string): StatValue {
  // "40%" → { num: 40, suffix: "%", prefix: "" }
  // "3x"  → { num: 3,  suffix: "x", prefix: "" }
  // "99.9%" → { num: 99.9, suffix: "%", prefix: "" }
  // "$49" → { num: 49, suffix: "", prefix: "$" }
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
      // easeOut cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * num;
      setDisplay(isDecimal ? current.toFixed(1) : Math.floor(current).toString());
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [inView, num, isDecimal]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5 px-4">
      <p className="text-3xl font-bold tabular-nums tracking-tight text-primary sm:text-4xl" aria-label={value}>
        {prefix}{display}{suffix}
      </p>
      <p className="text-sm leading-snug text-muted-foreground text-center">{label}</p>
    </div>
  );
}

const stats = [
  { value: "40%", label: "Reducción en errores operativos" },
  { value: "x10", label: "Más rápida la comunicación clínica-laboratorio" },
  { value: "25%", label: "Ahorro en costos de gestión" },
  { value: "99.9%", label: "Uptime garantizado" },
];

export function Stats() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4 sm:divide-x sm:divide-border">
          {stats.map((stat) => (
            <AnimatedStat key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
