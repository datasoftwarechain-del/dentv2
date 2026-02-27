"use client";

import CurvedLoop from "@/components/ui/curved-loop";

export function CurvedTextSection() {
  return (
    <section className="relative w-full py-20 overflow-hidden bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto px-4 mb-8">
        <h2 className="text-3xl md:text-4xl sm:text-5xl font-bold text-center">
          La infraestructura digital detrás de clínicas que operan mejor.
        </h2>
        <p className="text-center text-muted-foreground mt-4 max-w-2xl mx-auto">
          DigitalDent integra agenda, órdenes, alertas, horas, conecta turnos y facturación en un solo sistema que simplifica cada proceso.
          <br className="hidden sm:block" />
          Al formar parte de nuestro equipo digital, también puedes acceder a ventajas especiales y descuentos exclusivos en productos y servicios.
        </p>
      </div>

      <div className="h-[220px] sm:h-[320px] lg:h-[400px] flex items-center" aria-hidden="true">
        <span className="sr-only">Conectamos Clínicas Con Laboratorios Dentales</span>
        <CurvedLoop
          marqueeText="ODONTOLOGÍA ✦ ÓRDENES DIGITALES ✦ FACTURACIÓN AUTOMATIZADA ✦ AGENDA TURNOS ✦ CALENDARIO ✦ ALERTAS ✦"
          speed={2}
          curveAmount={400}
          direction="left"
          interactive
          className="fill-primary"
        />
      </div>
    </section>
  );
}
