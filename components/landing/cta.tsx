import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { FINAL_CTA } from "@/content/landing";

export function Cta() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-40">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-accent/10" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[#044c64] text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {FINAL_CTA.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{FINAL_CTA.subtitle}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="premium-transition w-full gap-2 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto">
              <Link href={FINAL_CTA.primary.href}>
                {FINAL_CTA.primary.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="premium-transition w-full hover:-translate-y-0.5 active:translate-y-0 sm:w-auto">
              <Link href={FINAL_CTA.secondary.href}>{FINAL_CTA.secondary.label}</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground/60">{FINAL_CTA.note}</p>
        </div>
      </div>
    </section>
  );
}
