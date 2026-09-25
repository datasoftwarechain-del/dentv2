import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Pillars } from "@/components/landing/pillars";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ServiciosSection } from "@/components/landing/servicios/servicios-section";
import { getPublicDesignPrices } from "@/lib/design/public-prices";
import { getPublicStats } from "@/lib/landing/public-stats";
import { formatMoney } from "@/lib/money";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { ScrollSection } from "@/components/landing/scroll-section";
import { LenisProvider } from "@/components/landing/lenis-provider";
import dynamic from "next/dynamic";

const ChatWidget = dynamic(() =>
  import("@/components/landing/chat-widget").then((m) => ({ default: m.ChatWidget }))
);

export default async function HomePage() {
  // Los precios salen del catálogo real, no de una constante del código:
  // la landing y la factura tienen que decir lo mismo. Solo se publican
  // los de DISEÑO, como "Desde US$ X" (el total depende de piezas y
  // revisiones). Fresado e impresión NO llevan precio público: se
  // cotizan por solicitud.
  const [designRaw, stats] = await Promise.all([getPublicDesignPrices(), getPublicStats()]);
  const designPrices = Object.fromEntries(
    Object.entries(designRaw).map(([code, p]) => [code, p > 0 ? `Desde ${formatMoney(p, "USD")}` : null]),
  );

  return (
    <LenisProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Saltar al contenido principal
      </a>
      <Header />
      <main id="main-content">
        {/* Orden de venta: promesa → tres caminos → servicios (lo que paga
            hoy) → cómo funciona → plataforma → cifras reales → precios →
            objeciones → cierre. Sin marquee, testimonios inventados ni
            newsletter: no vendían. */}
        <ScrollSection>
          <Hero />
        </ScrollSection>
        <ScrollSection>
          <Pillars />
        </ScrollSection>
        <ScrollSection>
          <ServiciosSection designPrices={designPrices} />
        </ScrollSection>
        <ScrollSection>
          <HowItWorks />
        </ScrollSection>
        <ScrollSection>
          <Features />
        </ScrollSection>
        <ScrollSection>
          <Stats stats={stats} />
        </ScrollSection>
        <ScrollSection>
          <Pricing />
        </ScrollSection>
        <ScrollSection>
          <Faq />
        </ScrollSection>
        <ScrollSection>
          <Cta />
        </ScrollSection>
      </main>
      <Footer />
      <ChatWidget />
    </LenisProvider>
  );
}
