"use client";

/**
 * Abanico de servicios de diseño: cierre de la sección Servicios.
 *
 * Es el lienzo claro del export de Claude Design ("Subí tu escaneo.
 * Recibí el diseño."): seis cards chicas sobre un arco elíptico
 * (cx 600 · cy 590 · rx 500 · ry 450, 28,8° entre cards, rotadas
 * (ang − 270)·0,22°) alrededor del titular, y un panel con el servicio
 * elegido que manda al flujo de solicitud existente.
 *
 * Va DESPUÉS de fresado e impresión, como llamado final a pedir un
 * diseño: no compite con el coverflow del bloque 01, que es el catálogo
 * completo; acá van seis destacados.
 *
 * MOBILE: el arco no cabe en 390px. Se vuelve un rail de cards chicas
 * (drag con mouse incluido) y el mismo panel debajo.
 *
 * MOVIMIENTO: entrada escalonada de las cards al entrar en pantalla,
 * elevación al pasar el mouse, cambio de panel con fundido, y rotación
 * automática del destacado cada 4 s mientras nadie lo toca (se frena con
 * hover/foco y prefers-reduced-motion).
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScopeChip } from "./scope-chip";
import { useDragScroll } from "./use-drag-scroll";
import { DESIGN_ARC, type ServiceCardContent } from "@/content/servicios";
import { Clock, Globe, Layers } from "lucide-react";

interface DesignArcProps {
  items: ServiceCardContent[];
  prices?: Record<string, string | null>;
}

// Geometría del export, sobre un escenario de 1200 × 740.
const STAGE_W = 1200;
const CX = 600, CY = 590, RX = 500, RY = 450;
const START_DEG = 198, STEP_DEG = 28.8;
const CARD_W = 176, CARD_H = 196;
const SMALL_CARD_W = 176;
const AUTOPLAY_MS = 4000;
const IDLE_AFTER_INTERACTION_MS = 9000;

export function DesignArc({ items, prices = {} }: DesignArcProps) {
  const n = items.length;
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(-1);
  const [paused, setPaused] = useState(false);
  const idleUntil = useRef(0);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.4 });
  const dragScroll = useDragScroll(SMALL_CARD_W + 12);

  useEffect(() => {
    if (reduceMotion || !inView || paused || n === 0) return;
    const id = window.setInterval(() => {
      if (document.hidden || Date.now() < idleUntil.current) return;
      setSelected((s) => (s + 1) % n);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, inView, paused, n]);

  const pick = (i: number) => {
    idleUntil.current = Date.now() + IDLE_AFTER_INTERACTION_MS;
    setSelected(i);
  };

  const sel = items[selected];
  const pad = (v: number) => String(v).padStart(2, "0");

  if (!sel) return null;

  return (
    <div
      ref={rootRef}
      className="relative rounded-[32px] bg-[var(--dd-mist-100)] lg:rounded-[40px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); setHovered(-1); }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
    >
      {/* ═══ Desktop: arco ═══ */}
      <div className="relative hidden h-[740px] overflow-hidden lg:block">
        <div className="absolute left-1/2 top-0 h-full -ml-[600px]" style={{ width: STAGE_W }}>
          {items.map((item, i) => {
            const ang = START_DEG + i * STEP_DEG;
            const rad = (ang * Math.PI) / 180;
            // Redondeado: el coseno del servidor y del navegador difieren en
            // el último decimal y React lo reportaba como desajuste de hidratación.
            const x = Math.round((CX + RX * Math.cos(rad)) * 100) / 100;
            const y = Math.round((CY + RY * Math.sin(rad)) * 100) / 100;
            const tilt = Math.round((ang - 270) * 0.22 * 100) / 100;
            const act = i === selected, hov = i === hovered;
            return (
              <motion.button
                key={item.key}
                type="button"
                aria-pressed={act}
                aria-label={`${item.title} · ${item.time}`}
                onClick={() => pick(i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(-1)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(-1)}
                className="focus-ring absolute box-border cursor-pointer rounded-[22px] bg-white p-2 text-left"
                style={{
                  left: x - CARD_W / 2, top: y - CARD_H / 2, width: CARD_W,
                  border: `1px solid ${act ? "var(--dd-deep-600)" : hov ? "rgba(32,80,104,.28)" : "rgba(32,80,104,.06)"}`,
                  boxShadow: act
                    ? "0 0 0 3px rgba(32,80,104,.14), 0 18px 44px rgba(18,45,60,.16)"
                    : hov ? "0 18px 44px rgba(18,45,60,.16)" : "0 6px 18px rgba(18,45,60,.08)",
                  transition: "box-shadow 200ms cubic-bezier(.4,0,.2,1), border-color 200ms cubic-bezier(.4,0,.2,1)",
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 40, rotate: tilt }}
                whileInView={{ opacity: 1, y: hov || act ? -6 : 0, rotate: tilt }}
                viewport={{ once: true, amount: 0.2 }}
                animate={{ y: hov || act ? -6 : 0, rotate: tilt }}
                transition={reduceMotion ? { duration: 0 } : {
                  opacity: { duration: 0.5, delay: i * 0.08 },
                  y: { type: "spring", stiffness: 300, damping: 24 },
                  rotate: { duration: 0.5, delay: i * 0.08 },
                }}
              >
                <SmallCardBody item={item} lift={hov || act} />
              </motion.button>
            );
          })}

          {/* Centro: badge, titular, panel */}
          <div className="absolute left-1/2 top-[268px] flex w-[500px] -ml-[250px] flex-col items-center gap-4 text-center">
            <Badge />
            <Title />
            <Panel item={sel} index={selected} total={n} price={prices[sel.key] ?? null} pad={pad} />
          </div>
        </div>
      </div>

      {/* ═══ Mobile: titular + rail + panel ═══ */}
      <div className="flex flex-col gap-4 py-8 lg:hidden">
        <div className="flex flex-col items-center gap-3 px-5 text-center">
          <Badge small />
          <Title small />
        </div>
        <div
          role="tablist"
          aria-label="Servicios destacados"
          className={cn("flex gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", dragScroll.className)}
          style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}
          {...dragScroll.handlers}
        >
          {items.map((item, i) => {
            const act = i === selected;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={act}
                onClick={() => pick(i)}
                className={cn(
                  "focus-ring box-border flex-none rounded-[22px] bg-white p-2 text-left transition-[box-shadow,border-color] duration-200",
                  act ? "border border-[var(--dd-deep-600)] shadow-[0_0_0_3px_rgba(32,80,104,.14),0_18px_44px_rgba(18,45,60,.16)]"
                      : "border border-[rgba(32,80,104,.06)] shadow-[0_6px_18px_rgba(18,45,60,.08)]",
                )}
                style={{ width: SMALL_CARD_W, scrollSnapAlign: "start" }}
              >
                <SmallCardBody item={item} lift={act} />
              </button>
            );
          })}
          <div className="w-1 flex-none" aria-hidden="true" />
        </div>
        <div className="px-4">
          <Panel item={sel} index={selected} total={n} price={prices[sel.key] ?? null} pad={pad} />
        </div>
      </div>
    </div>
  );
}

// ─── Piezas ──────────────────────────────────────────────────

function SmallCardBody({ item, lift }: { item: ServiceCardContent; lift: boolean }) {
  return (
    <>
      <div className={cn("relative h-[112px] overflow-hidden rounded-2xl", item.image ? "bg-[#dbf4f7]" : "bg-[var(--dd-mist-100)]")}>
        {item.image ? (
          <Image
            src={item.image} alt="" fill sizes="176px" loading="lazy"
            className={cn("object-contain p-[24px_14px_8px] transition-transform duration-[360ms] ease-[cubic-bezier(.4,0,.2,1)]", lift && "scale-[1.08]")}
          />
        ) : (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 flex items-center justify-center px-3 pt-7 text-center font-mono text-[9.5px] uppercase leading-[1.3] text-[var(--dd-deep-400)]",
              "bg-[repeating-linear-gradient(135deg,rgba(32,80,104,.06)_0_8px,transparent_8px_16px)]",
              "transition-transform duration-[360ms]", lift && "scale-[1.08]",
            )}
          >
            {item.placeholder}
          </div>
        )}
        <div className="absolute left-[7px] top-[7px]"><ScopeChip scope={item.scope} size="sm" /></div>
      </div>
      <div className="flex flex-col gap-1.5 px-1.5 pb-1 pt-2.5">
        <span className="text-[14px] font-semibold leading-[1.25] text-[var(--dd-deep-800)] [text-wrap:pretty]">{item.title}</span>
        <span className="text-[12px] font-medium tabular-nums text-[var(--dd-deep-400)]">{item.time}</span>
      </div>
    </>
  );
}

function Badge({ small = false }: { small?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-2 rounded-full bg-[var(--dd-deep-600)] font-semibold uppercase text-[var(--dd-mist-200)]",
      small ? "h-[30px] px-3 pl-[9px] text-[11.5px] tracking-[.06em]" : "h-9 px-4 pl-3 text-[13px] tracking-[.08em]",
    )}>
      <Globe className={small ? "h-[15px] w-[15px]" : "h-[17px] w-[17px]"} aria-hidden="true" />
      {DESIGN_ARC.badge}
    </span>
  );
}

function Title({ small = false }: { small?: boolean }) {
  return (
    <h3 className={cn("m-0 font-medium text-[var(--dd-deep-800)]", small ? "text-[28px] leading-[1.08] tracking-[-.02em]" : "text-[44px] leading-[1.05] tracking-[-.025em]")}>
      <span className={cn("block uppercase text-[var(--dd-deep-400)]", small ? "mb-2 text-[12px] tracking-[.14em]" : "mb-3 text-[14px] tracking-[.14em]")}>
        {DESIGN_ARC.kicker}
      </span>
      {DESIGN_ARC.title[0]}<br />{DESIGN_ARC.title[1]}
    </h3>
  );
}

function Panel({ item, index, total, price, pad }: {
  item: ServiceCardContent; index: number; total: number; price: string | null; pad: (v: number) => string;
}) {
  return (
    <div className="mt-2 w-full rounded-3xl bg-white p-5 text-left shadow-[0_18px_44px_rgba(18,45,60,.12)] lg:px-6" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.key}
          className="flex flex-col gap-3.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[20px] font-semibold leading-[1.2] text-[var(--dd-deep-800)]">{item.title}</span>
            <span className="whitespace-nowrap text-[12px] font-medium tabular-nums text-[var(--dd-deep-400)]">{pad(index + 1)} / {pad(total)}</span>
          </div>
          <p className="m-0 text-[14.5px] leading-[1.5] text-[var(--dd-neutral-700)]">{item.description}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <PanelChip><Clock className="h-[13px] w-[13px]" aria-hidden="true" />{item.time}</PanelChip>
              <PanelChip><Layers className="h-[13px] w-[13px]" aria-hidden="true" />{item.spec}</PanelChip>
              {price && <PanelChip>{price}</PanelChip>}
            </div>
            <Link
              href={item.href}
              className="focus-ring inline-flex h-10 items-center justify-center rounded-full bg-[var(--dd-deep-600)] px-5 text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[var(--dd-deep-700)]"
            >
              {item.cta}
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PanelChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(32,80,104,.1)] bg-[var(--dd-mist-050)] px-2.5 text-[12px] font-medium tabular-nums leading-none text-[var(--dd-deep-700)]">
      {children}
    </span>
  );
}
