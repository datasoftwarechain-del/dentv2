"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Crea tu cuenta",
    description: "Regístrate en minutos, sin tarjeta de crédito. Configura tu perfil y empieza a operar el mismo día.",
  },
  {
    number: "02",
    title: "Conecta con socios",
    description: "Clínicas se conectan con sus laboratorios de confianza. Los laboratorios reciben solicitudes automáticamente.",
  },
  {
    number: "03",
    title: "Gestiona pedidos",
    description: "Envía órdenes con especificaciones detalladas, archivos STL y fechas de entrega. Todo en un solo lugar.",
  },
  {
    number: "04",
    title: "Factura y cobra",
    description: "Genera facturas automáticas al cerrar trabajos. Controla pagos y mantén tu contabilidad al día.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border bg-card py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">Simple desde el día 1</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Empieza en menos de 10 minutos
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Sin instalaciones, sin capacitaciones largas. Solo entra, configura y opera desde el primer día.
          </p>
        </div>

        <div className="relative mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line — desktop only */}
          <div
            className="absolute left-0 right-0 hidden h-px bg-gradient-to-r from-transparent via-border/60 to-transparent lg:block"
            style={{ top: "1.75rem" }}
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              className="relative"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.15, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="mb-4 text-4xl font-bold text-muted-foreground/30 lg:text-5xl">
                {step.number}
              </div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
