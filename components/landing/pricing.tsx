"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { PRICING_INTRO } from "@/content/landing";

// Dos planes, en US$. Sin plan gratuito y sin prometer lo que no existe
// (API, SLA): lo que se lista es lo que la plataforma hace hoy.
const plans = [
  {
    name: "Profesional",
    price: "US$ 49",
    period: "/mes",
    description: "Para clínicas en crecimiento que necesitan control total de su operación.",
    features: [
      "Pedidos ilimitados",
      "Hasta 5 usuarios",
      "Tablero Kanban completo",
      "Facturación automática",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    cta: "Crear cuenta",
    highlighted: true,
  },
  {
    name: "Empresa",
    price: "Personalizado",
    description: "Infraestructura a medida para laboratorios y equipos de alto volumen.",
    features: [
      "Todo en Profesional",
      "Usuarios ilimitados",
      "Integraciones custom",
      "Soporte dedicado",
    ],
    cta: "Contactar ventas",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="precios" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">{PRICING_INTRO.eyebrow}</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {PRICING_INTRO.title}
          </h2>
        </div>

        {/* Servicios: precio por caso. Los planes de abajo son la plataforma. */}
        <p className="mx-auto mt-6 flex max-w-3xl flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-center text-sm text-muted-foreground sm:flex-row sm:gap-4">
          <span>{PRICING_INTRO.services}</span>
          <Link href={PRICING_INTRO.servicesCta.href} className="focus-ring whitespace-nowrap rounded-sm font-medium text-primary underline-offset-4 hover:underline">
            {PRICING_INTRO.servicesCta.label} →
          </Link>
        </p>

        <p className="mt-8 text-center text-sm text-muted-foreground/70">
          Planes de la plataforma · Sin contratos · Cambiá o cancelá cuando quieras
        </p>

        <div className="mx-auto mt-10 grid max-w-4xl gap-8 lg:grid-cols-2">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.1, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ y: -4 }}
            >
              <Card
                className={`glass-card relative h-full border-none ${
                  plan.highlighted
                    ? "ring-2 ring-accent/60 shadow-2xl shadow-accent/15"
                    : "bg-card/40"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Más Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <CardDescription className="text-sm leading-snug">{plan.description}</CardDescription>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                    {plan.period && (
                      <span className="text-base text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/sign-up" className="mt-auto">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
