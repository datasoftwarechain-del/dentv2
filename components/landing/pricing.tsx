"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Starter",
    price: "Gratis",
    description: "Para comenzar a digitalizar tu consultorio sin riesgo.",
    features: [
      "Hasta 20 pedidos/mes",
      "1 usuario",
      "Gestión básica de pacientes",
      "Soporte dentro de la plataforma",
    ],
    cta: "Comenzar Gratis",
    highlighted: false,
  },
  {
    name: "Profesional",
    price: "$49",
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
    cta: "Iniciar Prueba Gratis",
    highlighted: true,
  },
  {
    name: "Empresa",
    price: "Personalizado",
    description: "Infraestructura a medida para laboratorios y equipos de alto volumen.",
    features: [
      "Todo en Profesional",
      "Usuarios ilimitados",
      "API personalizada",
      "Integraciones custom",
      "Soporte dedicado 24/7",
      "SLA garantizado",
    ],
    cta: "Contactar Ventas",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">Elige tu plan</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Sin contratos. Sin letras chicas. Cambiá de plan cuando quieras.
          </h2>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground/70">
          ✓ Cancela cuando quieras &nbsp;·&nbsp; ✓ Sin contratos largos &nbsp;·&nbsp; ✓ Soporte incluido en todos los planes
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
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
