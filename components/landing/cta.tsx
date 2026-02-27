import Link from "next/link";
import { Button } from "@/components/ui/button";


export function Cta() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      <div className="absolute inset-x-0 -z-10 h-full bg-gradient-to-b from-primary/5 to-accent/10" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[#044c64] text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Sumáte a las clínicas y laboratorios que ya operan con claridad, velocidad y control.
          </h2>
          <div className="mt-10">
            <Link href="/auth/sign-up">
              <Button size="lg" className="premium-transition hover:-translate-y-0.5 active:translate-y-0">
                Crear cuenta gratuita
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground/60">
            Funciona desde cualquier dispositivo · Soporte
          </p>
        </div>
      </div>
    </section>
  );
}
