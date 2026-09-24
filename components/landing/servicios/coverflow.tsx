"use client";

/**
 * Coverflow 3D de los servicios de diseño.
 *
 * DESKTOP: cinco cards visibles en perspectiva; la central es la activa y
 * la única interactiva. Flechas, puntos, contador y teclado (← →). Las
 * transformaciones vienen del export de diseño:
 *   translateX(off·270px) translateZ(−|off|·160px) rotateY(off·−28°)
 * con opacidad y saturación decrecientes hacia los lados.
 *
 * MOBILE: sin 3D. Un carril con scroll-snap nativo — el gesto de swipe
 * es del navegador, no de un listener nuestro — y puntos que siguen la
 * posición de scroll. Es lo que hace el mockup en 390px, y es lo que
 * funciona con un pulgar.
 *
 * ACCESIBILIDAD: región etiquetada, contador en aria-live para que el
 * lector anuncie "3 de 12" al navegar, y las cards laterales sin foco
 * (inert) para que Tab no recorra doce botones invisibles.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ServiceCard } from "./service-card";
import { useDragScroll } from "./use-drag-scroll";
import type { ServiceCardContent } from "@/content/servicios";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CoverflowProps {
  items: ServiceCardContent[];
  prices?: Record<string, string | null>;
  label: string;
}

const EASE = "cubic-bezier(.4,0,.2,1)";
const MOBILE_CARD = 331;
const MOBILE_GAP = 12;

export function Coverflow({ items, prices = {}, label }: CoverflowProps) {
  const n = items.length;
  const [active, setActive] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const dragScroll = useDragScroll(MOBILE_CARD + MOBILE_GAP);

  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  // Teclado sobre el carrusel de escritorio.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
  };

  // Los puntos de mobile siguen el scroll real, no un estado propio.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => {
      const i = Math.min(n - 1, Math.round(rail.scrollLeft / (MOBILE_CARD + MOBILE_GAP)));
      setMobileIndex(i);
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => rail.removeEventListener("scroll", onScroll);
  }, [n]);

  const pad = (v: number) => String(v).padStart(2, "0");

  return (
    <>
      {/* ═══ Desktop: coverflow 3D ═══ */}
      <div
        role="region"
        aria-roledescription="carrusel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        className="focus-ring relative hidden lg:block h-[560px] outline-none rounded-3xl"
        style={{ perspective: 1600 }}
      >
        <div className="absolute inset-0">
          {items.map((item, i) => {
            // Distancia circular al activo, en [-3, 2] para n cards.
            const off = ((i - active + n + 3) % n) - 3;
            const abs = Math.abs(off);
            const isActive = off === 0;
            const hidden = abs > 2;
            return (
              <div
                key={item.key}
                onClick={() => !isActive && go(i)}
                aria-hidden={!isActive}
                className={cn("absolute left-1/2 top-5 w-[340px] -ml-[170px] motion-reduce:transition-none", !isActive && !hidden && "cursor-pointer")}
                style={{
                  transform: `translateX(${off * 270}px) translateZ(${-abs * 160}px) rotateY(${off * -28}deg)`,
                  zIndex: 10 - abs,
                  opacity: hidden ? 0 : 1 - abs * 0.22,
                  filter: abs ? `saturate(${1 - abs * 0.2})` : "none",
                  pointerEvents: hidden ? "none" : "auto",
                  transition: `transform 360ms ${EASE}, opacity 360ms ${EASE}, filter 360ms ${EASE}`,
                }}
              >
                <ServiceCard item={item} size="hero" active={isActive} inert={!isActive} price={prices[item.key] ?? null} className="h-[500px]" />
              </div>
            );
          })}
        </div>

        <ArrowButton side="left" onClick={() => go(active - 1)} />
        <ArrowButton side="right" onClick={() => go(active + 1)} />
      </div>

      <div className="hidden lg:flex items-center justify-center gap-5 mt-2">
        <div className="flex items-center gap-2.5" role="tablist" aria-label="Ir a un servicio">
          {items.map((item, i) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={i === active}
              aria-label={item.title}
              onClick={() => go(i)}
              className="h-2 rounded-full transition-all duration-200 motion-reduce:transition-none"
              style={{ width: i === active ? 22 : 8, background: i === active ? "var(--dd-deep-600)" : "rgba(75,127,155,.3)" }}
            />
          ))}
        </div>
        <span className="text-[13px] font-medium tabular-nums text-[var(--dd-deep-400)]" aria-live="polite">
          {pad(active + 1)} / {pad(n)}
        </span>
      </div>

      {/* ═══ Mobile: scroll-snap ═══ */}
      <div
        ref={railRef}
        role="region"
        aria-label={label}
        className={cn("lg:hidden flex gap-3 overflow-x-auto px-5 pb-5 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", dragScroll.className)}
        style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 20 }}
        {...dragScroll.handlers}
      >
        {items.map((item) => (
          <div key={item.key} className="flex-none" style={{ width: MOBILE_CARD, scrollSnapAlign: "start" }}>
            <ServiceCard item={item} size="hero" price={prices[item.key] ?? null} className="h-[480px]" />
          </div>
        ))}
        <div className="flex-none w-2" aria-hidden="true" />
      </div>
      <div className="lg:hidden flex justify-center gap-2 pb-2" aria-hidden="true">
        {items.map((item, i) => (
          <span key={item.key} className="h-2 rounded-full transition-all duration-200"
            style={{ width: i === mobileIndex ? 22 : 8, background: i === mobileIndex ? "var(--dd-deep-600)" : "rgba(75,127,155,.3)" }} />
        ))}
      </div>
    </>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Anterior" : "Siguiente"}
      className={cn(
        "focus-ring absolute top-[210px] z-30 flex h-14 w-14 items-center justify-center rounded-full",
        "border border-[rgba(32,80,104,.16)] bg-white/80 text-[var(--dd-deep-600)] backdrop-blur-md",
        "transition-colors duration-150 hover:bg-[var(--dd-deep-600)] hover:text-white",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
    </button>
  );
}
