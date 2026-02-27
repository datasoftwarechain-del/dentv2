"use client";

import { CalendarDays, ClipboardList, Package, Receipt, BarChart3, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

const features = [
  {
    icon: CalendarDays,
    title: "Agenda Inteligente",
    description: "Vista semanal optimizada, recordatorios automáticos y gestión completa de tu agenda desde cualquier dispositivo.",
  },
  {
    icon: ClipboardList,
    title: "Historia Clínica Digital",
    description: "Historial completo del paciente con radiografías, notas y evolución clínica siempre a mano.",
  },
  {
    icon: Package,
    title: "Órdenes Digitales a Laboratorio",
    description: "Carga especificaciones completas, adjunta archivos STL y recibe actualizaciones de estado en tiempo real.",
  },
  {
    icon: Receipt,
    title: "Facturación Automática",
    description: "Genera facturas automáticamente al cerrar cada trabajo y mantén el control de pagos pendientes.",
  },
  {
    icon: BarChart3,
    title: "Reportes y Analíticas",
    description: "Dashboards con métricas clave: ingresos, tiempos de entrega, productividad y satisfacción del cliente.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad y Privacidad",
    description: "Datos encriptados, backups automáticos y cumplimiento con normativas de protección de datos de salud.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">Todo en un solo lugar</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Una plataforma pensada para clínicas modernas
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Cada módulo diseñado para eliminar fricción y darte control total de tu flujo de trabajo
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
