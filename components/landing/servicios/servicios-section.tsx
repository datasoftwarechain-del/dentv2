"use client";

/**
 * Sección "Servicios" de la landing.
 *
 * Variante A del export de diseño (coverflow 3D) con la paleta clara de
 * la variante B. Los tokens --dd-* viven en el style del <section>, no en
 * globals.css: la sección trae su propia paleta sin pisar el resto de la
 * landing, y si un día se quita, no queda CSS huérfano.
 *
 * Tres bloques: 01 Diseño digital (Online, carrusel), 02 Fresado CAM
 * y 03 Impresión 3D (Uruguay, grilla en desktop y carril con scroll-snap
 * en mobile). Los textos salen de content/servicios.ts y del catálogo.
 */

import { motion } from "framer-motion";
import {
  SERVICIOS_HEADER, DESIGN_BLOCK, DESIGN_ARC, LOCAL_BLOCKS, LOCAL_FOOTNOTE, designCards,
  type ServiceCardContent,
} from "@/content/servicios";
import { ScopeChip } from "./scope-chip";
import { ServiceCard } from "./service-card";
import { Archivo } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { Coverflow } from "./coverflow";
import { DesignArc } from "./design-arc";
import { DesignCatalogList } from "./design-catalog-list";
import { ArrowUpRight, Clock, Layers } from "lucide-react";
import Link from "next/link";
import { useDragScroll } from "./use-drag-scroll";
import { cn } from "@/lib/utils";

interface ServiciosSectionProps {
  /** Precio formateado por service_code de diseño. */
  designPrices: Record<string, string | null>;
  /** Precio formateado por key de card física. */
}

const TOKENS: React.CSSProperties = {
  ["--dd-deep-900" as string]: "#122d3c",
  ["--dd-deep-800" as string]: "#17384a",
  ["--dd-deep-700" as string]: "#1b4257",
  ["--dd-deep-600" as string]: "#205068",
  ["--dd-deep-400" as string]: "#4b7f9b",
  ["--dd-deep-300" as string]: "#7ea6ba",
  ["--dd-mint-600" as string]: "#3fb9a4",
  ["--dd-mint-400" as string]: "#90ecdc",
  ["--dd-mist-200" as string]: "#dbf5f6",
  ["--dd-mist-100" as string]: "#e9fafb",
  ["--dd-mist-050" as string]: "#f4fdfd",
  ["--dd-neutral-700" as string]: "#3d4f58",
};

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

/**
 * Tipografía del design system del export: Archivo (sustituto documentado
 * de la grotesca Helvetica de las listas de precios de Digital Dent).
 * Solo esta sección; el resto de la landing sigue en Inter.
 */
const archivo = Archivo({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], display: "swap" });

export function ServiciosSection({ designPrices }: ServiciosSectionProps) {
  // Rails móviles de 02/03. El mismo hook sirve para los dos.
  // El paso del arrastre con mouse tiene que coincidir con el ancho REAL de
  // la card, que ahora es responsivo. Con 331 fijo, al soltar en una pantalla
  // angosta el carril aterrizaba entre dos cards.
  const railRef = useRef<HTMLUListElement | null>(null);
  const [step, setStep] = useState(331 + 12);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const medir = () => {
      const primera = rail.firstElementChild as HTMLElement | null;
      if (primera) setStep(primera.offsetWidth + 12);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);
  const dragScroll = useDragScroll(step);
  const catalog = designCards();
  // La primera card que se ve tiene que tener imagen real, no un placeholder.
  // Se rota el catálogo (no se reordena la lista por categoría) para que
  // valga igual en el coverflow de desktop y en el carril nativo de mobile.
  const firstWithImage = Math.max(0, catalog.findIndex((d) => d.image));
  const design = [...catalog.slice(firstWithImage), ...catalog.slice(0, firstWithImage)];
  // Seis destacados para el abanico de cierre, en el orden del arco.
  const arcItems = DESIGN_ARC.featured
    .map((code) => design.find((d) => d.key === code))
    .filter((d): d is ServiceCardContent => Boolean(d));

  return (
    <section
      id="servicios"
      style={TOKENS}
      className={cn(archivo.className, "relative scroll-mt-16 overflow-hidden bg-[var(--dd-mist-050)] text-[var(--dd-deep-800)]")}
    >
      {/* Halo menta detrás del coverflow, como en el mockup pero sobre claro. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[260px] h-[720px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(144,236,220,.28)_0%,rgba(43,99,131,.10)_38%,rgba(244,253,253,0)_70%)]" />

      <div className="relative mx-auto max-w-[1200px] px-5 pt-12 lg:px-0 lg:pt-24">
        {/* ═══ Encabezado ═══ */}
        <motion.div {...reveal} className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div className="flex flex-col gap-3.5 lg:gap-[18px]">
            <span className="text-[11px] font-medium uppercase tracking-[.14em] text-[var(--dd-mint-600)] lg:text-[12px]">
              {SERVICIOS_HEADER.eyebrow}
            </span>
            <h2 className="m-0 max-w-[760px] text-[32px] font-medium leading-[1.05] tracking-[-.025em] text-[var(--dd-deep-800)] [text-wrap:balance] lg:text-[48px] lg:leading-[1.04]">
              {SERVICIOS_HEADER.title}
            </h2>
            <p className="m-0 max-w-[600px] text-[15.5px] leading-[1.55] text-[var(--dd-neutral-700)] [text-wrap:pretty] lg:text-[18px]">
              {SERVICIOS_HEADER.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white px-5 py-[18px] shadow-[0_6px_18px_rgba(18,45,60,.08)]">
            <div className="flex items-center gap-3">
              <ScopeChip scope="worldwide" size="sm" />
              <span className="text-[13.5px] text-[var(--dd-deep-700)]">{SERVICIOS_HEADER.scopes.worldwide}</span>
            </div>
            <div className="flex items-center gap-3">
              <ScopeChip scope="uruguay" size="sm" />
              <span className="text-[13.5px] text-[var(--dd-deep-700)]">{SERVICIOS_HEADER.scopes.uruguay}</span>
            </div>
          </div>
        </motion.div>

      </div>

      {/* ═══ 01 · Diseño digital — franja oscura fundida con el fondo claro ═══
          Full-bleed dentro de la sección (overflow-hidden). El contenido queda
          en la zona 100% oscura (28%–72%); los tramos que se funden son solo
          padding, sin nada encima. --page-bg = fondo de la sección. */}
      <div
        className="design-section relative mt-10 w-screen left-1/2 -translate-x-1/2 overflow-hidden py-[144px] lg:mt-14 lg:py-[176px]"
        // El degradado vive en globals.css (.design-section): un gradiente
        // sRGB entre azul oscuro y casi blanco pasa por un gris sucio; ahí
        // se interpola en oklab con paradas intermedias azules, y hay
        // fallback sRGB para navegadores sin soporte.
        style={{ color: "#dbf5f6" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[720px] w-[1100px] -translate-x-1/2 -translate-y-[45%]"
          style={{ background: "radial-gradient(ellipse at center, rgba(144,236,220,.20) 0%, rgba(43,99,131,.28) 38%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-[1200px] px-5 lg:px-0">
        <motion.div {...reveal} className="relative z-[1] flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="flex flex-col gap-3 lg:gap-4">
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              <span className="text-[13px] font-medium tabular-nums text-[#7ea6ba] lg:text-[14px]">{DESIGN_BLOCK.number}</span>
              <h3 className="m-0 text-[26px] font-medium tracking-[-.02em] text-white lg:text-[40px]">{DESIGN_BLOCK.title}</h3>
              <ScopeChip scope="worldwide" size="lg" className="hidden !bg-[#90ecdc] !text-[#122d3c] lg:inline-flex" />
              <ScopeChip scope="worldwide" size="md" className="!bg-[#90ecdc] !text-[#122d3c] lg:hidden" />
            </div>
            <p className="m-0 max-w-[560px] text-[14.5px] leading-[1.5] text-[#a9c6cf] lg:text-[17px]">{DESIGN_BLOCK.subtitle}</p>
          </div>
          <ol className="hidden items-center gap-2.5 text-[13.5px] text-[#dbf5f6] lg:flex" aria-label="Cómo funciona">
            {DESIGN_BLOCK.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-2.5">
                {i > 0 && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#90ecdc]" />}
                {step}
              </li>
            ))}
          </ol>
        </motion.div>

        <div className="relative z-[1] mt-6 lg:mt-12">
          <Coverflow items={design} prices={designPrices} label={`${DESIGN_BLOCK.number} · ${DESIGN_BLOCK.title}`} />
        </div>
        <div className="relative z-[1]">
          <DesignCatalogList items={design} prices={designPrices} />
        </div>
        </div>
      </div>

      {/* ═══ 02 · 03 · Fresado e Impresión ═══ */}
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-0 pb-16 pt-10 lg:gap-20 lg:pb-28">
        {LOCAL_BLOCKS.map((blk, bi) => {
          // Impresión tiene dos productos: a dos columnas en tamaño hero
          // llenan la fila; a cuatro dejaban media fila vacía.
          const twoUp = blk.items.length <= 2;
          return (
          <motion.div key={blk.key} {...reveal} className="flex flex-col gap-4 border-t border-[rgba(32,80,104,.12)] pt-8 lg:gap-7 lg:pt-14">
            <div className="flex flex-col gap-3 px-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:px-0">
              <div className="flex flex-col gap-2.5 lg:gap-3">
                <div className="flex flex-wrap items-center gap-3 lg:gap-3.5">
                  <span className="text-[13px] font-medium text-[var(--dd-deep-400)] lg:text-[14px]">{blk.number}</span>
                  <h3 className="m-0 text-[22px] font-medium tracking-[-.02em] text-[var(--dd-deep-800)] lg:text-[30px]">{blk.title}</h3>
                  <ScopeChip scope="uruguay" size="md" label="Disponible en Uruguay" />
                </div>
                <p className="m-0 text-[14px] leading-[1.55] text-[var(--dd-neutral-700)] lg:text-[15.5px]">{blk.subtitle}</p>
              </div>
              {bi === 0 && (
                <span className="flex items-center gap-2 text-[12px] text-[var(--dd-deep-400)] lg:whitespace-nowrap lg:text-[13px]">
                  <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full border-[1.5px] border-[var(--dd-deep-400)]" />
                  {LOCAL_FOOTNOTE}
                </span>
              )}
            </div>

            {/* Desktop: grilla. Mobile: carril con snap. */}
            <ul className={cn("hidden gap-5 lg:grid", twoUp ? "lg:grid-cols-2" : "lg:grid-cols-4")} aria-label={blk.title}>
              {blk.items.map((item) => (
                <li key={item.key}>
                  <ServiceCard item={item} size={twoUp ? "hero" : "compact"} showScope={false} className={twoUp ? "h-[440px]" : "h-[390px]"} />
                </li>
              ))}
            </ul>
            <ul
              ref={railRef}
              className={cn("flex gap-3 overflow-x-auto px-5 pb-5 pt-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", dragScroll.className)}
              style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 20 }}
              aria-label={blk.title}
              {...dragScroll.handlers}
            >
              {/* Mismo criterio que el carril de Diseño: 331 px es el TOPE, no
                  el ancho. Fijo no entraba en un teléfono de 360 y la card se
                  veía cortada contra el borde. */}
              {blk.items.map((item) => (
                <li key={item.key} className="flex-none" style={{ width: "min(331px, calc(100vw - 68px))", scrollSnapAlign: "start" }}>
                  <ServiceCard item={item} size="compact" showScope={false} className="h-[380px]" />
                </li>
              ))}
              <li className="w-2 flex-none" aria-hidden="true" />
            </ul>

            {blk.banner && <BringYourFileBanner item={blk.banner} />}
          </motion.div>
          );
        })}

        {/* ═══ Cierre · Subí tu escaneo. Recibí el diseño. ═══ */}
        <motion.div {...reveal} className="mt-16 lg:mt-24">
          <DesignArc items={arcItems} prices={designPrices} />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * "¿Ya tenés el diseño?": es otra oferta (traé tu archivo), no un
 * material más. Como banner ancho cierra la grilla de fresado en vez de
 * quedar como quinta card sola en una segunda fila.
 */
function BringYourFileBanner({ item }: { item: ServiceCardContent }) {
  return (
    <div className="px-5 lg:px-0">
      <Link
        href={item.href}
        className="focus-ring group flex flex-col gap-4 rounded-[24px] border border-[rgba(32,80,104,.1)] bg-white p-5 shadow-[0_6px_18px_rgba(18,45,60,.06)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[rgba(32,80,104,.28)] hover:shadow-[0_18px_44px_rgba(18,45,60,.14)] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-6"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[18px] font-semibold leading-[1.25] tracking-[-.01em] text-[var(--dd-deep-800)] lg:text-[20px]">{item.title}</span>
          <span className="text-[13.5px] leading-[1.5] text-[var(--dd-neutral-700)] lg:text-[14.5px]">{item.description}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(32,80,104,.1)] bg-[var(--dd-mist-050)] px-2.5 text-[12px] font-medium tabular-nums leading-none text-[var(--dd-deep-700)]">
              <Clock className="h-[13px] w-[13px]" aria-hidden="true" />{item.time}
            </span>
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(32,80,104,.1)] bg-[var(--dd-mist-050)] px-2.5 text-[12px] font-medium tabular-nums leading-none text-[var(--dd-deep-700)]">
              <Layers className="h-[13px] w-[13px]" aria-hidden="true" />{item.spec}
            </span>
          </span>
        </div>
        <span className="inline-flex h-10 flex-none items-center justify-center gap-1.5 rounded-full bg-[var(--dd-deep-600)] px-5 text-[14px] font-medium text-white transition-colors duration-200 group-hover:bg-[var(--dd-deep-700)]">
          {item.cta}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
