"use client";

import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const testimonials = [
  {
    stars: 5,
    quote:
      "Desde que adoptamos DigitalDent, los errores en las órdenes desaparecieron casi por completo. Procesamos el doble de trabajos con la mitad del caos. Lo recomiendo a cualquier laboratorio que quiera crecer en serio.",
    name: "Carlos Méndez",
    role: "Director Técnico",
    company: "Laboratorio DentaLab Pro",
    avatar: "CM",
  },
  {
    stars: 5,
    quote:
      "Conectamos con nuevos laboratorios en días y centralizamos agenda, pedidos y facturación en un solo lugar. Le devolvió horas a mi equipo que antes se perdían en WhatsApp y hojas de cálculo.",
    name: "Dra. Sofía Ramírez",
    role: "Directora Clínica",
    company: "Clínica Sonrisa Perfecta",
    avatar: "SR",
  },
  {
    stars: 5,
    quote:
      "Enviaba órdenes por foto y rezaba para que llegaran bien. Hoy cargo la especificación completa en minutos y sé exactamente cuándo estará lista. DigitalDent es lo que la odontología digital necesitaba.",
    name: "Dr. Martín García",
    role: "Odontólogo Estético",
    company: "Consultorio Privado",
    avatar: "MG",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} estrellas de 5`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star
          key={i}
          className="h-4 w-4 text-accent"
          fill="currentColor"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">Lo que dicen nuestros usuarios</p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Resultados reales. Historias reales.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Profesionales que dejaron el caos operativo atrás — y no tienen ningún motivo para volver.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                delay: index * 0.12,
                duration: 0.55,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="h-full"
            >
              <Card className="glass-card h-full border-none bg-card/40">
                <CardContent className="flex h-full flex-col gap-4 pt-6">
                  <Stars count={t.stars} />

                  <blockquote className="flex-1 text-sm leading-relaxed text-foreground/80">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  <div className="flex items-center gap-3 border-t border-border/50 pt-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.role} · {t.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
