import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicDesignRequestForm } from "@/components/design/public-design-request-form";

export const metadata: Metadata = {
  title: "Solicitar un diseño CAD/CAM | DigitalDent",
  description:
    "Pedí el diseño digital de tu caso: coronas, puentes, férulas, prótesis y All-on-X. Subí tus escaneos intraorales y recibí el STL listo para imprimir o fresar.",
};

/** [design-intake] Puerta de entrada pública, sin cuenta previa. */
export default function SolicitarDisenoPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-[#044c64]">Digital</span>
            <span className="text-[#09919b]">Dent</span>
          </Link>
          <Link href="/auth/login" className="text-sm text-slate-500 hover:text-[#09919b]">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mx-auto mb-10 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#044c64] sm:text-4xl">
            Solicitar un diseño
          </h1>
          <p className="mt-3 text-slate-600">
            Elegí el trabajo, dejanos tus datos y subí los escaneos. Nuestro equipo
            diseña el caso y te devuelve el STL listo para imprimir o fresar.
          </p>
        </div>

        {/* useSearchParams (?servicio=) exige Suspense o el prerender falla en build. */}
        <Suspense fallback={null}>
          <PublicDesignRequestForm />
        </Suspense>
      </div>
    </main>
  );
}
