"use client";

import { CalendarDays, ClipboardList, Package, Receipt, BarChart3, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

const features = [
  {
    icon: CalendarDays,
    title: "Agenda Inteligente",
    description: "Organizá tu semana de un vistazo. Turnos, disponibilidad y recordatorios automáticos gestionados desde cualquier dispositivo, en cualquier momento.",
  },
  {
    icon: ClipboardList,
    title: "Historia Clínica Digital",
    description: "Todo el historial de tu paciente en un solo lugar: radiografías, notas clínicas y evolución. Acceso inmediato cuando más lo necesitás.",
  },
  {
    icon: Package,
    title: "Órdenes Digitales a Laboratorio",
    description: "Enviá órdenes con especificaciones precisas y archivos .STL. Tu laboratorio las recibe al instante y seguís cada paso del proceso en tiempo real.",
  },
  {
    icon: Receipt,
    title: "Facturación Automática",
    description: "Cada trabajo cerrado genera su factura automáticamente. Sin retrasos, sin olvidos. Control total de cobros y pagos pendientes en tiempo real.",
  },
  {
    icon: BarChart3,
    title: "Reportes y Analíticas",
    description: "Tomá decisiones con datos, no con intuición. Dashboards con ingresos, tiempos de entrega, productividad del equipo y satisfacción del paciente.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad y Privacidad",
    description: "Tus datos protegidos con backups automáticos. Tu operación nunca se detiene, sin importar qué.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">Todo en un solo lugar</p>
          <h2 className="text-primary text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Diseñada para la odontología digital que no para.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Cada módulo resuelve un problema real de tu flujo de trabajo, con la precisión y simplicidad que tu equipo necesita desde el primer día.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.1, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Card className="glass-card h-full border-none bg-card/40">
                <CardHeader className="gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
                    <feature.icon className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg font-semibold leading-snug">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
