"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Crea tu cuenta",
    description: "Registro en minutos, sin tarjeta de crédito. Configurá tu perfil y comenzá a operar el mismo día.",
  },
  {
    number: "02",
    title: "Conecta con socios",
    description: "Vinculá tu clínica con los laboratorios que ya conocés o descubrí nuevos socios. Las solicitudes fluyen automáticamente, sin intermediarios.",
  },
  {
    number: "03",
    title: "Gestiona pedidos",
    description: "Enviá órdenes completas con especificaciones, archivos STL y fechas de entrega. Seguí cada trabajo en tiempo real desde el primer clic.",
  },
  {
    number: "04",
    title: "Factura y cobra",
    description: "Facturas generadas automáticamente al cerrar cada trabajo. Controlá cobros pendientes y mantené tu contabilidad siempre al día.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border bg-card py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">Simple desde el día 1</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Empezá en menos de 10 minutos.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Sin instalaciones ni capacitaciones largas. Entrá, configurá y operá desde el primer momento.
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
