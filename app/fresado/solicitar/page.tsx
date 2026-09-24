import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LabRequestForm } from "@/components/lab-requests/lab-request-form";
import { LAB_PRODUCTS } from "@/lib/lab-requests/products";
import { getPublicLabPrices } from "@/lib/design/public-prices";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Cotizar fresado o impresión 3D | DigitalDent",
  description:
    "Pedí zirconio, disilicato, PMMA, modelos impresos o el fresado de tu STL. Producción en nuestro laboratorio con envío gratis a todo Uruguay.",
};

/**
 * [040_lab_requests] Puerta pública de fresado e impresión.
 *
 * No crea cuenta: deja una solicitud que el laboratorio convierte en
 * orden. Los precios de referencia salen del mismo catálogo que las
 * cards de la landing; los que están en 0 se muestran "a cotizar".
 */
export default async function SolicitarFresadoPage() {
  const raw = await getPublicLabPrices(LAB_PRODUCTS.map((p) => p.catalogName));
  const priceLabels = Object.fromEntries(
    LAB_PRODUCTS.map((p) => {
      const v = raw[p.catalogName];
      return [p.key, v ? formatMoney(v, "ARS") : "A cotizar"];
    }),
  );

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-[#044c64]">Digital</span>
            <span className="text-[#09919b]">Dent</span>
          </Link>
          <Link href="/#servicios" className="text-sm text-slate-500 hover:text-[#09919b]">
            Ver todos los servicios
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mx-auto mb-10 max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#09919b]">
            Fresado CAM · Impresión 3D · Solo Uruguay
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#044c64] sm:text-4xl">
            Cotizar un trabajo
          </h1>
          <p className="mt-3 text-slate-600">
            Contanos qué necesitás, dejanos tus datos y, si ya lo tenés, subí el STL.
            El laboratorio revisa la solicitud, la confirma con vos y la ingresa a producción.
          </p>
        </div>

        <Suspense fallback={null}>
          <LabRequestForm priceLabels={priceLabels} />
        </Suspense>
      </div>
    </main>
  );
}
