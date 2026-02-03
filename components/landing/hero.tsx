import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Background radial gradient for depth */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent to-primary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.187rem]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-muted-foreground">Plataforma líder en gestión dental</span>
          </div>

          <h1 className="text-premium-gradient text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Conectamos Clínicas Dentales con Laboratorios
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Gestiona pedidos, produccion y facturacion en una sola plataforma.
            Reduce errores, ahorra tiempo y mejora la comunicacion entre tu clinica y laboratorio.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="premium-transition gap-2 hover:scale-105 active:scale-95">
                Comenzar Gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="lg" className="premium-transition hover:bg-accent/10">
                Ver Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
