import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Gratis",
    description: "Perfecto para comenzar",
    features: [
      "Hasta 50 pedidos/mes",
      "1 usuario",
      "Gestion basica de pacientes",
      "Soporte por email",
    ],
    cta: "Comenzar Gratis",
    highlighted: false,
  },
  {
    name: "Profesional",
    price: "$49",
    period: "/mes",
    description: "Para clinicas en crecimiento",
    features: [
      "Pedidos ilimitados",
      "Hasta 5 usuarios",
      "Tablero Kanban completo",
      "Facturacion automatica",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    cta: "Iniciar Prueba",
    highlighted: true,
  },
  {
    name: "Empresa",
    price: "Personalizado",
    description: "Para laboratorios grandes",
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
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Planes para cada necesidad
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Elige el plan que mejor se adapte a tu clinica o laboratorio
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.highlighted
                  ? "border-2 border-primary shadow-lg"
                  : "border-border/50"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Mas Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-accent" />
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
          ))}
        </div>
      </div>
    </section>
  );
}
