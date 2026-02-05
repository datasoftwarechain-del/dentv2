"use client";

import { ReactLenis } from "lenis/react";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { CurvedTextSection } from "@/components/landing/curved-text-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";
import { ScrollSection } from "@/components/landing/scroll-section";

export default function HomePage() {
  return (
    <ReactLenis root>
      <Header />
      <main>
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
          <Pricing />
        </ScrollSection>
      </main>
      <Footer />
    </ReactLenis>
  );
}
