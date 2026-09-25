"use client";

/**
 * Coverflow 3D de los servicios de diseño (vidrio oscuro).
 *
 * DESKTOP: cinco cards visibles, todas de 340px, en absoluto y centradas;
 * la central es la activa y la única interactiva. Flechas, puntos,
 * contador y teclado (← →). La perspectiva va DENTRO del transform de
 * cada card (no en el contenedor) y no hay filter ni preserve-3d: es lo
 * que en Safari rompía el backdrop-filter y aplastaba las cards.
 *   perspective(1600px) translateX(off·320) translateZ(−|off|·180) rotateY(off·−24°)
 * 320 y 180 no se achican: con menos, el borde de la lateral que gira
 * hacia adelante se mete en la del centro.
 *
 * MOBILE: sin 3D. Un carril con scroll-snap nativo — el gesto de swipe
 * es del navegador, no de un listener nuestro — y puntos que siguen la
 * posición de scroll. Es lo que hace el mockup en 390px, y es lo que
 * funciona con un pulgar.
 *
 * MOVIMIENTO: autoplay cada 4,5 s mientras la sección se ve y nadie la
 * toca (se frena con hover, foco, gesto, pestaña oculta y
 * prefers-reduced-motion); arrastre/swipe horizontal sobre el escenario
 * y gesto de trackpad; la activa respira. Nada de esto es necesario para
 * usarlo: flechas, puntos y teclado siguen siendo la vía principal.
 *
 * ACCESIBILIDAD: región etiquetada, contador en aria-live para que el
 * lector anuncie "3 de 12" al navegar, y las cards laterales sin foco
 * (inert) para que Tab no recorra doce botones invisibles.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, type PanInfo } from "framer-motion";
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

const MOBILE_CARD = 331;
const EASE = "cubic-bezier(.4,0,.2,1)";
const CARD_W = 340;
const CARD_STEP = 320;
const CARD_DEPTH = 180;
const CARD_TILT = -24;
const AUTOPLAY_MS = 4500;
/** Tras una interacción, el autoplay espera esto antes de retomar. */
const IDLE_AFTER_INTERACTION_MS = 9000;
const PAN_THRESHOLD_PX = 40;
const PAN_VELOCITY = 350;
const WHEEL_COOLDOWN_MS = 550;
const MOBILE_GAP = 12;

export function Coverflow({ items, prices = {}, label }: CoverflowProps) {
  const n = items.length;
  const [active, setActive] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const dragScroll = useDragScroll(MOBILE_CARD + MOBILE_GAP);

  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  // ─── Vida propia: autoplay, gesto, trackpad ─────────────────
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { amount: 0.5 });
  const [paused, setPaused] = useState(false);
  const idleUntil = useRef(0);
  const panned = useRef(false);
  const lastWheel = useRef(0);

  useEffect(() => {
    if (reduceMotion || !inView || paused) return;
    const id = window.setInterval(() => {
      if (document.hidden || Date.now() < idleUntil.current) return;
      setActive((a) => (a + 1) % n);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, inView, paused, n]);

  /** Navegación hecha por la persona: cuenta como interacción y posterga el autoplay. */
  const goUser = useCallback((i: number) => {
    idleUntil.current = Date.now() + IDLE_AFTER_INTERACTION_MS;
    go(i);
  }, [go]);

  const onPanStart = () => { panned.current = true; };
  const onPanEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const dx = info.offset.x, vx = info.velocity.x;
    if (dx < -PAN_THRESHOLD_PX || vx < -PAN_VELOCITY) goUser(active + 1);
    else if (dx > PAN_THRESHOLD_PX || vx > PAN_VELOCITY) goUser(active - 1);
    // El click que cierra el gesto no debe elegir una card.
    window.setTimeout(() => { panned.current = false; }, 0);
  };
  // Solo el gesto horizontal del trackpad: la rueda vertical es del scroll de la página.
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return;
    const now = Date.now();
    if (now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    goUser(e.deltaX > 0 ? active + 1 : active - 1);
  };

  // Teclado sobre el carrusel de escritorio.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); goUser(active - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); goUser(active + 1); }
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
      <motion.div
        ref={stageRef}
        role="region"
        aria-roledescription="carrusel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        onPanStart={onPanStart}
        onPanEnd={onPanEnd}
        onWheel={onWheel}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
        className="focus-ring relative hidden lg:block h-[560px] overflow-visible outline-none rounded-3xl cursor-grab active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
      >
        <div className="absolute inset-0">
          {items.map((item, i) => {
            // Distancia circular al activo, en [-3, 2] para n cards.
            const off = ((i - active + n + 3) % n) - 3;
            const abs = Math.abs(off);
            const isActive = off === 0;
            const hidden = abs > 2;
            // Key estable (id del servicio): React conserva el nodo y la
            // transición CSS se ve; con el índice las volvería a crear.
            return (
              <div
                key={item.key}
                onClick={() => { if (panned.current) return; if (!isActive) goUser(i); }}
                aria-hidden={!isActive}
                className="motion-reduce:transition-none"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 20,
                  width: CARD_W,
                  marginLeft: -CARD_W / 2,
                  transform: `perspective(1600px) translateX(${off * CARD_STEP}px) translateZ(${-abs * CARD_DEPTH}px) rotateY(${off * CARD_TILT}deg)`,
                  transformOrigin: "50% 50%",
                  zIndex: 10 - abs,
                  opacity: hidden ? 0 : 1 - abs * 0.22,
                  pointerEvents: hidden ? "none" : "auto",
                  cursor: off ? "pointer" : "default",
                  transition: `transform 360ms ${EASE}, opacity 360ms ${EASE}`,
                  willChange: "transform, opacity",
                }}
              >
                {/* La activa respira: un vaivén lento de 5px que la mantiene viva sin distraer. */}
                <motion.div
                  animate={isActive && !reduceMotion ? { y: [0, -5, 0] } : { y: 0 }}
                  transition={isActive && !reduceMotion ? { duration: 5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
                >
                  <ServiceCard item={item} size="hero" theme="dark" active={isActive} inert={!isActive} price={prices[item.key] ?? null} className="h-[500px]" />
                </motion.div>
              </div>
            );
          })}
        </div>

        <ArrowButton side="left" onClick={() => goUser(active - 1)} />
        <ArrowButton side="right" onClick={() => goUser(active + 1)} />
      </motion.div>

      <div className="hidden lg:flex items-center justify-center gap-5 mt-2">
        <div className="flex items-center gap-2.5" role="tablist" aria-label="Ir a un servicio">
          {items.map((item, i) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={i === active}
              aria-label={item.title}
              onClick={() => goUser(i)}
              className="h-2 rounded-full transition-all duration-200 motion-reduce:transition-none"
              style={{ width: i === active ? 22 : 8, background: i === active ? "#90ecdc" : "rgba(126,166,186,.45)" }}
            />
          ))}
        </div>
        <span className="text-[13px] font-medium tabular-nums text-[#7ea6ba]" aria-live="polite">
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
            <ServiceCard item={item} size="hero" theme="dark" price={prices[item.key] ?? null} className="h-[480px]" />
          </div>
        ))}
        <div className="flex-none w-2" aria-hidden="true" />
      </div>
      <div className="lg:hidden flex justify-center gap-2 pb-2" aria-hidden="true">
        {items.map((item, i) => (
          <span key={item.key} className="h-2 rounded-full transition-all duration-200"
            style={{ width: i === mobileIndex ? 22 : 8, background: i === mobileIndex ? "#90ecdc" : "rgba(126,166,186,.45)" }} />
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
        // Spec del export: 56px, borde y fondo de vidrio, hover invertido.
        "border border-[rgba(219,245,246,.28)] bg-[rgba(219,245,246,.1)] text-[#dbf5f6] backdrop-blur-[12px]",
        "transition-colors duration-150 hover:bg-[#dbf5f6] hover:text-[#1b4257]",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
    </button>
  );
}
