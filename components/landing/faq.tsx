"use client";

/**
 * Las objeciones reales del flujo, respondidas con lo que el sistema hace
 * de verdad (formatos, plazos, pago, alcance, privacidad). Es la sección
 * que más levanta la conversión de un servicio pago.
 */

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQ } from "@/content/landing";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label mb-3">{FAQ.eyebrow}</p>
          <h2 className="text-[#044c64] text-balance text-3xl font-bold tracking-tight sm:text-4xl">{FAQ.title}</h2>
        </div>
        <Accordion type="single" collapsible className="mx-auto mt-12 max-w-3xl">
          {FAQ.items.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold text-[#044c64]">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
