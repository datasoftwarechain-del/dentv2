import type { Metadata } from "next";
import Link from "next/link";
import { DesignerApplicationForm } from "@/components/design/designer-application-form";

export const metadata: Metadata = {
  title: "Sumate al equipo de diseño | DigitalDent",
  description:
    "¿Sos diseñador dental CAD? Postulate al equipo de diseño de DigitalDent. Contanos tu experiencia, el software que usás y los trabajos que hacés.",
};

/** [042_designers] Puerta de entrada pública para diseñadores. */
export default function DisenadoresPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-[-.005em]">
            <span className="text-[#044c64]">Digital</span>
            <span className="text-[#09919b]">Dent</span>
          </Link>
          <Link href="/auth/login" className="text-sm text-slate-500 hover:text-[#09919b]">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-[-.018em] text-[#044c64] sm:text-4xl sm:tracking-[-.022em]">
            Sumate al equipo de diseño
          </h1>
          <p className="mt-3 text-slate-600">
            Trabajamos con diseñadores dentales para resolver los casos que llegan de
            clínicas y laboratorios. Dejanos tus datos y te escribimos.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            No hace falta crear una cuenta. Revisamos cada postulación a mano.
          </p>
        </div>

        <DesignerApplicationForm />
      </div>
    </main>
  );
}
