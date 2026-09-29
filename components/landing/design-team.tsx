import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PenTool } from "lucide-react";
import { DESIGN_TEAM } from "@/content/landing";

/**
 * [042_designers] Convocatoria a diseñadores CAD.
 *
 * Va DESPUÉS del cierre de venta y antes del pie: el visitante que compra
 * (clínica o laboratorio) ya pasó por todo el embudo, y el que busca
 * trabajo no se pierde esta franja porque está al final, donde se la
 * busca. Metida entre las secciones de venta le sacaría foco a la oferta.
 *
 * Registro visual deliberadamente más bajo que el de <Cta>: una franja
 * fina, sin degradado ni título grande, para que no compita con el cierre.
 */
export function DesignTeam() {
  return (
    <section aria-labelledby="equipo-diseno" className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <span
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex"
              aria-hidden="true"
            >
              <PenTool className="h-5 w-5" />
            </span>
            <div>
              <h2 id="equipo-diseno" className="text-base font-semibold">
                {DESIGN_TEAM.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{DESIGN_TEAM.subtitle}</p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="premium-transition w-full shrink-0 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
          >
            <Link href={DESIGN_TEAM.href}>{DESIGN_TEAM.cta}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
