"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { PRICING_INTRO } from "@/content/landing";
import { OPEN_CHAT_EVENT } from "@/lib/landing/events";

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
      "Historia clínica",
      "Facturación automática",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    cta: "Crear cuenta",
    ctaHref: "/auth/sign-up",
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
    // Sin canal de ventas todavía: abre el formulario de contacto del
    // widget en vez de mandar a crear una cuenta, que no es lo que dice.
    ctaHref: null,
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="precios" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">{PRICING_INTRO.eyebrow}</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-[-.018em] sm:text-4xl sm:tracking-[-.022em]">
            {PRICING_INTRO.title}
          </h2>
        </div>

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
                    {PRICING_INTRO.badge}
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <CardDescription className="text-sm leading-snug">{plan.description}</CardDescription>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-[-.022em]">{plan.price}</span>
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
                  {plan.ctaHref ? (
                    <Button asChild className="mt-auto w-full" variant={plan.highlighted ? "default" : "outline"}>
                      <Link href={plan.ctaHref}>{plan.cta}</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="mt-auto w-full"
                      variant="outline"
                      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT))}
                    >
                      {plan.cta}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
