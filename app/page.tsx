import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { CurvedTextSection } from "@/components/landing/curved-text-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ServiciosSection } from "@/components/landing/servicios/servicios-section";
import { getPublicDesignPrices, getPublicLabPrices } from "@/lib/design/public-prices";
import { LOCAL_BLOCKS } from "@/content/servicios";
import { formatMoney } from "@/lib/money";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { ScrollSection } from "@/components/landing/scroll-section";
import { LenisProvider } from "@/components/landing/lenis-provider";
import dynamic from "next/dynamic";

const Newsletter = dynamic(() =>
  import("@/components/landing/newsletter").then((m) => ({ default: m.Newsletter }))
);
const ChatWidget = dynamic(() =>
  import("@/components/landing/chat-widget").then((m) => ({ default: m.ChatWidget }))
);

export default async function HomePage() {
  // Los precios salen del catálogo real, no de una constante del código:
  // la landing y la factura tienen que decir lo mismo. Diseño en US$,
  // laboratorio en $; lo que no tiene precio dice "a cotizar".
  const [designRaw, labRaw] = await Promise.all([
    getPublicDesignPrices(),
    getPublicLabPrices(
      LOCAL_BLOCKS.flatMap((b) => b.items.map((i) => i.catalogName)).filter((n): n is string => !!n),
    ),
  ]);
  const designPrices = Object.fromEntries(
    Object.entries(designRaw).map(([code, p]) => [code, p > 0 ? formatMoney(p, "USD") : null]),
  );
  const labPrices = Object.fromEntries(
    LOCAL_BLOCKS.flatMap((b) => b.items).map((i) => [
      i.key,
      i.catalogName && labRaw[i.catalogName] ? formatMoney(labRaw[i.catalogName]!, "ARS") : "A cotizar",
    ]),
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
        <ScrollSection>
          <Hero />
        </ScrollSection>
        <ScrollSection>
          <Stats />
        </ScrollSection>
        <ScrollSection>
          <Features />
        </ScrollSection>
        <ScrollSection>
          <CurvedTextSection />
        </ScrollSection>
        <ScrollSection>
          <HowItWorks />
        </ScrollSection>
        <ScrollSection>
          <ServiciosSection designPrices={designPrices} labPrices={labPrices} />
        </ScrollSection>
        <ScrollSection>
          <Testimonials />
        </ScrollSection>
        <ScrollSection>
          <Pricing />
        </ScrollSection>
        <ScrollSection>
          <Cta />
        </ScrollSection>
      </main>
      <Newsletter />
      <Footer />
      <ChatWidget />
    </LenisProvider>
  );
}
