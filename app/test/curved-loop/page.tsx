"use client";

import CurvedLoop from "@/components/ui/curved-loop";

export default function CurvedLoopDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Demo 1: Basic Usage */}
      <section className="border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-4 text-center">Basic Usage</h2>
        </div>
        <CurvedLoop marqueeText="Welcome to DigitalDent ✦" />
      </section>

      {/* Demo 2: Custom Props */}
      <section className="border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-4 text-center">Custom Speed & Curve</h2>
        </div>
        <CurvedLoop
          marqueeText="Be ✦ Creative ✦ With ✦ React ✦ Bits ✦"
          speed={3}
          curveAmount={500}
          direction="right"
          interactive
          className="fill-primary"
        />
      </section>

      {/* Demo 3: Slower Non-Interactive */}
      <section className="border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-4 text-center">Slower Speed</h2>
        </div>
        <CurvedLoop
          marqueeText="Conectamos ✦ Clínicas ✦ Con ✦ Laboratorios ✦"
          speed={1.5}
          curveAmount={300}
          interactive
          className="fill-accent"
        />
      </section>

      {/* Demo 4: Custom Brand Colors */}
      <section>
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-4 text-center">Brand Style</h2>
        </div>
        <CurvedLoop
          marqueeText="Digital ✦ Dental ✦ Management ✦ Platform ✦"
          speed={2}
          curveAmount={400}
          direction="left"
          interactive
          className="fill-[#5227FF]"
        />
      </section>
    </div>
  );
}
