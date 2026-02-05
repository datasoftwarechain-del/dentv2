"use client";

import CurvedLoop from "@/components/ui/curved-loop";

export function CurvedTextSection() {
  return (
    <section className="relative w-full py-20 overflow-hidden bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto px-4 mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center">
          Nuestra Misión
        </h2>
        <p className="text-center text-muted-foreground mt-4 max-w-2xl mx-auto">
          Transformando la gestión dental con tecnología innovadora
        </p>
      </div>

      <div className="h-[400px] flex items-center">
        <CurvedLoop
          marqueeText="Conectamos ✦ Clínicas ✦ Con ✦ Laboratorios ✦ Dentales ✦"
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
