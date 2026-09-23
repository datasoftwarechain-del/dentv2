"use client";

/**
 * [design-intake] Sección de Diseño Digital en la landing.
 *
 * Es la puerta de entrada del negocio de diseño: alguien que nunca oyó
 * hablar de nosotros tiene que entender qué hacemos y poder pedirlo sin
 * crear una cuenta primero.
 *
 * Los servicios salen de lib/design/services.ts, el mismo archivo que
 * alimenta el desplegable del formulario y la facturación. Si mañana se
 * agrega un servicio, aparece acá solo — no hay una segunda lista que
 * se olvide de actualizar.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { groupServicesByCategory } from "@/lib/design/services";
import { formatMoney } from "@/lib/money";
import { ArrowRight, Upload, PenTool, Download } from "lucide-react";

const PASOS = [
  { icon: Upload, title: "Subís tus escaneos", text: "STL, PLY, DCM o el .zip que exporta tu escáner." },
  { icon: PenTool, title: "Diseñamos el caso", text: "Nuestro equipo trabaja en CAD y te manda una previsualización." },
  { icon: Download, title: "Descargás el STL", text: "Aprobás el diseño y bajás el archivo listo para imprimir o fresar." },
];

/** Precio publicado de cada servicio, por código. Vacío = no se muestra. */
export type PublicPrices = Record<string, number>;

const UNIDAD: Record<string, string> = {
  unit: "por unidad",
  tooth: "por pieza",
  arch: "por arcada",
  case: "por caso",
};

export function DesignServices({ prices = {} }: { prices?: PublicPrices }) {
  const grupos = groupServicesByCategory();
  const hayPrecios = Object.keys(prices).length > 0;

  return (
    <section id="diseno-digital" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-label">Diseño digital</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#044c64] sm:text-4xl">
            Diseño CAD/CAM, sin instalar nada
          </h2>
          <p className="mt-4 text-slate-600">
            Mandanos el escaneo intraoral y te devolvemos el STL diseñado. Para
            odontólogos, clínicas y laboratorios, desde donde estés.
          </p>
          {hayPrecios && (
            <p className="mt-2 text-sm text-slate-400">
              Precios en dólares estadounidenses.
            </p>
          )}
        </div>

        {/* ─── Cómo funciona ─────────────────────────────── */}
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {PASOS.map((paso, i) => {
            const Icon = paso.icon;
            return (
              <motion.div
                key={paso.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e0f4f6]">
                  <Icon className="h-5 w-5 text-[#09919b]" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-semibold text-[#044c64]">{paso.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{paso.text}</p>
              </motion.div>
            );
          })}
        </div>

        {/* ─── Los servicios ─────────────────────────────── */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {grupos.map((grupo, i) => (
            <motion.div
              key={grupo.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#09919b]">
                {grupo.label}
              </h3>
              <ul className="mt-3 space-y-3">
                {grupo.services.map((s) => {
                  const precio = prices[s.code];
                  return (
                    <li key={s.code} className="leading-snug">
                      <p className="text-sm text-slate-600">{s.label}</p>
                      {/* El precio solo aparece si está cargado. Un "desde
                          $0" o un "consultar" en cada línea haría que la
                          grilla prometa algo que no puede cumplir. */}
                      {precio > 0 && (
                        <p className="mt-0.5 text-sm font-semibold text-[#044c64]">
                          {formatMoney(precio, "USD")}{" "}
                          <span className="font-normal text-slate-400">
                            {UNIDAD[s.billingUnit] ?? ""}
                          </span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* ─── CTA ───────────────────────────────────────── */}
        <div className="mt-14 text-center">
          <Link
            href="/disenos/solicitar"
            className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#044c64] px-7 py-3.5 font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-[#09919b]"
          >
            Solicitar un diseño
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-sm text-slate-500">
            No hace falta tener cuenta. Se crea sola al enviar el pedido.
          </p>
        </div>
      </div>
    </section>
  );
}
