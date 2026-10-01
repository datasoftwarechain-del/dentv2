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
 * MOVIMIENTO: la pila vive en una POSICIÓN CONTINUA (`pos`, un
 * MotionValue en unidades de card, no un índice entero). De ahí salen
 * todos los transforms, y eso es lo que permite tres cosas que antes no
 * pasaban:
 *   1. El arrastre es 1:1 — la pila sigue al dedo durante todo el gesto.
 *      Antes no se movía nada hasta soltar.
 *   2. Al soltar se PROYECTA el punto de reposo con la curva de deceleración
 *      (`v/1000 · d/(1−d)`, d=0.998) y se elige la card más cercana a esa
 *      proyección, así un envión fuerte viaja más que un arrastre corto.
 *      Antes cualquier gesto avanzaba exactamente una card.
 *   3. El movimiento es un spring que ARRANCA con la velocidad del dedo,
 *      no una transición CSS de 360 ms: no hay costura entre arrastrar y
 *      animar, y se puede agarrar en pleno vuelo y revertir.
 * Autoplay cada 4,5 s mientras la sección se ve y nadie la toca (se frena
 * con hover, foco, gesto, pestaña oculta y prefers-reduced-motion). Nada de
 * esto es necesario para usarlo: flechas, puntos y teclado siguen siendo la
 * vía principal.
 *
 * ACCESIBILIDAD: región etiquetada, contador en aria-live para que el
 * lector anuncie "3 de 12" al navegar, y las cards laterales sin foco
 * (inert) para que Tab no recorra doce botones invisibles.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, animate, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { ServiceCard } from "./service-card";
import { useDragScroll } from "./use-drag-scroll";
import type { ServiceCardContent } from "@/content/servicios";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CoverflowProps {
  items: ServiceCardContent[];
  prices?: Record<string, string | null>;
  label: string;
  /** Card activa al cargar: conviene una con imagen real, no un placeholder. */
  initialIndex?: number;
}

/**
 * Tope del ancho de la card en el carril móvil. El ancho REAL es
 * `min(MOBILE_CARD, 100vw - MOBILE_GUTTER)`: con 331 px fijos la card no
 * entraba en un teléfono de 360 px (331 + 40 de padding = 371) y se veía
 * cortada contra el borde. El resto del hueco deja asomar la card
 * siguiente, que es lo que avisa de que hay más para el costado.
 */
const MOBILE_CARD = 331;
/** Canaleta izquierda + hueco + asomo de la card siguiente. */
const MOBILE_GUTTER = 68;
const CARD_W = 340;
const CARD_STEP = 320;
const CARD_DEPTH = 180;
const CARD_TILT = -24;
const AUTOPLAY_MS = 4500;
/** Tras una interacción, el autoplay espera esto antes de retomar. */
const IDLE_AFTER_INTERACTION_MS = 9000;
const WHEEL_COOLDOWN_MS = 550;
/** Deceleración del scroll de iOS. 0.998 = inercia normal. */
const DECELERATION = 0.998;
/** Tope de cards que puede viajar un solo envión. Sin esto un flick fuerte cruza el catálogo. */
const MAX_FLICK_CARDS = 4;
/** Spring por defecto: crítico, sin rebote. No hubo gesto, no hay overshoot. */
const SPRING_UI = { type: "spring", bounce: 0, duration: 0.45 } as const;
/** Spring de gesto: algo de rebote, porque SÍ hubo momento físico. */
const SPRING_FLICK = { type: "spring", bounce: 0.18, duration: 0.5 } as const;

/** Punto de reposo proyectado a partir de la velocidad de salida (px o unidades/s). */
function project(velocity: number, deceleration = DECELERATION): number {
  return (velocity / 1000) * deceleration / (1 - deceleration);
}

/** Distancia circular con signo entre una card y la posición continua. */
function circularOffset(i: number, pos: number, n: number): number {
  let d = (((i - pos) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}
const MOBILE_GAP = 12;

/**
 * Una card del escenario 3D. Deriva TODO su transform de la posición
 * continua de la pila con `useTransform`, así que durante un arrastre se
 * mueve en el hilo del compositor sin re-renderizar React. Antes el
 * transform se recalculaba en cada render y la transición la hacía CSS.
 */
function CoverCard({
  i, n, pos, item, price, isActive, reduceMotion, onSelect,
}: {
  i: number;
  n: number;
  pos: MotionValue<number>;
  item: ServiceCardContent;
  price: string | null;
  isActive: boolean;
  reduceMotion: boolean;
  onSelect: () => void;
}) {
  const off = useTransform(pos, (p) => circularOffset(i, p, n));
  const transform = useTransform(off, (o) => {
    const abs = Math.abs(o);
    return `perspective(1600px) translateX(${o * CARD_STEP}px) translateZ(${-abs * CARD_DEPTH}px) rotateY(${o * CARD_TILT}deg)`;
  });
  // 2.6 y no 2: con posición continua hay fotogramas a mitad de camino y un
  // corte en 2 hacía parpadear la card que entra.
  const opacity = useTransform(off, (o) => (Math.abs(o) > 2.6 ? 0 : Math.max(0, 1 - Math.abs(o) * 0.22)));
  const zIndex = useTransform(off, (o) => Math.round(10 - Math.abs(o)));
  const pointerEvents = useTransform(off, (o) => (Math.abs(o) > 2.6 ? "none" : "auto"));

  return (
    <motion.div
      onClick={onSelect}
      aria-hidden={!isActive}
      style={{
        position: "absolute",
        left: "50%",
        top: 20,
        width: CARD_W,
        marginLeft: -CARD_W / 2,
        transform,
        transformOrigin: "50% 50%",
        zIndex,
        opacity,
        pointerEvents,
        cursor: isActive ? "default" : "pointer",
        willChange: "transform, opacity",
      }}
    >
      {/* La activa respira. 3,2 s y ±3 px: a 5 s el ciclo caía en la banda de
          ~0,2 Hz que molesta a quien es sensible al movimiento, y el gateo por
          reduceMotion no alcanza para quien no declara la preferencia. */}
      <motion.div
        animate={isActive && !reduceMotion ? { y: [0, -3, 0] } : { y: 0 }}
        transition={isActive && !reduceMotion
          ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
          : { type: "spring", bounce: 0, duration: 0.3 }}
      >
        <ServiceCard item={item} size="hero" theme="dark" active={isActive} inert={!isActive} showScope={false} price={price} className="h-[500px]" />
      </motion.div>
    </motion.div>
  );
}

export function Coverflow({ items, prices = {}, label, initialIndex = 0 }: CoverflowProps) {
  const n = items.length;
  const [active, setActive] = useState(Math.min(Math.max(initialIndex, 0), Math.max(n - 1, 0)));
  const [mobileIndex, setMobileIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const [mobileStep, setMobileStep] = useState(MOBILE_CARD + MOBILE_GAP);
  const dragScroll = useDragScroll(mobileStep);

  // Posición CONTINUA de la pila, en unidades de card. Es la única fuente de
  // verdad del movimiento; `active` se deriva de ella para los puntos, el
  // contador y la accesibilidad, y solo re-renderiza cuando cambia de card.
  const pos = useMotionValue(Math.min(Math.max(initialIndex, 0), Math.max(n - 1, 0)));
  const posAlEmpezar = useRef(0);
  const arrastrando = useRef(false);

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
      if (document.hidden || Date.now() < idleUntil.current || arrastrando.current) return;
      // Sin rebote: el autoplay no es un gesto, nadie le dio impulso.
      animate(pos, pos.get() + 1, SPRING_UI);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, inView, paused, pos]);

  // `active` se deriva de la posición continua, y SOLO cuando cambia de card:
  // suscribirse sin este guard re-renderizaría en cada frame del spring.
  useEffect(() => {
    let ultimo = -1;
    const unsub = pos.on("change", (v) => {
      const i = ((Math.round(v) % n) + n) % n;
      if (i !== ultimo) { ultimo = i; setActive(i); }
    });
    return () => unsub();
  }, [pos, n]);

  /** Lleva la pila a la card `i` por el camino más corto del círculo. */
  const irA = useCallback((i: number, opts: { flick?: boolean; velocity?: number } = {}) => {
    const destino = pos.get() + circularOffset(i, pos.get(), n);
    if (reduceMotion) { pos.set(destino); return; }
    animate(pos, destino, {
      ...(opts.flick ? SPRING_FLICK : SPRING_UI),
      ...(opts.velocity !== undefined ? { velocity: opts.velocity } : {}),
    });
  }, [pos, n, reduceMotion]);

  /** Navegación hecha por la persona: cuenta como interacción y posterga el autoplay. */
  const goUser = useCallback((i: number) => {
    idleUntil.current = Date.now() + IDLE_AFTER_INTERACTION_MS;
    irA(i);
  }, [irA]);

  // ─── Gesto: 1:1 mientras se arrastra, proyección al soltar ───
  const onPanStart = () => {
    panned.current = true;
    arrastrando.current = true;
    idleUntil.current = Date.now() + IDLE_AFTER_INTERACTION_MS;
    // Arranca desde el valor que hay EN PANTALLA, no desde el índice lógico:
    // si la pila venía animando, agarrarla no produce un salto.
    posAlEmpezar.current = pos.get();
  };

  const onPan = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    // Arrastrar a la derecha trae la card anterior: la posición baja.
    pos.set(posAlEmpezar.current - info.offset.x / CARD_STEP);
  };

  const onPanEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    arrastrando.current = false;
    // Velocidad del dedo convertida a unidades de card por segundo.
    const vCards = -info.velocity.x / CARD_STEP;
    const proyectado = pos.get() + project(vCards);
    const limite = MAX_FLICK_CARDS;
    const destino = Math.round(
      Math.max(posAlEmpezar.current - limite, Math.min(posAlEmpezar.current + limite, proyectado)),
    );
    if (reduceMotion) pos.set(destino);
    // La velocidad de salida se entrega al spring: sin costura entre el dedo
    // y la animación.
    else animate(pos, destino, { ...SPRING_FLICK, velocity: vCards });
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

  // El paso del carril se MIDE del DOM: el ancho de la card es responsivo,
  // así que una constante desincronizaba los puntos indicadores en cuanto
  // la pantalla era más angosta que 331 + 68.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const medir = () => {
      const primera = rail.firstElementChild as HTMLElement | null;
      if (primera) setMobileStep(primera.offsetWidth + MOBILE_GAP);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);

  // Los puntos de mobile siguen el scroll real, no un estado propio.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => {
      const i = Math.min(n - 1, Math.round(rail.scrollLeft / mobileStep));
      setMobileIndex(i);
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => rail.removeEventListener("scroll", onScroll);
  }, [n, mobileStep]);

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
        onPan={onPan}
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
          {items.map((item, i) => (
            // Key estable (id del servicio): React conserva el nodo entre
            // renders y el MotionValue no se reinicia.
            <CoverCard
              key={item.key}
              i={i}
              n={n}
              pos={pos}
              item={item}
              price={prices[item.key] ?? null}
              isActive={i === active}
              reduceMotion={Boolean(reduceMotion)}
              onSelect={() => { if (panned.current) return; if (i !== active) goUser(i); }}
            />
          ))}
        </div>

        <ArrowButton side="left" onClick={() => goUser(active - 1)} />
        <ArrowButton side="right" onClick={() => goUser(active + 1)} />
      </motion.div>

      <div className="hidden lg:flex items-center justify-center gap-5 mt-2">
        {/* El punto que se VE mide 8 px; el que se puede CLICKEAR mide 44 px
            de alto por el ancho del punto más medio hueco de cada lado. Antes
            el objetivo era de 8x8 y había que apuntarle. No llega a 44x44
            porque once objetivos de 44 de ancho harían una fila de 528 px:
            se gana todo el alto y el ancho que el espaciado permite. */}
        <div className="flex items-center" role="tablist" aria-label="Ir a un servicio">
          {items.map((item, i) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={i === active}
              aria-label={item.title}
              onClick={() => goUser(i)}
              className="focus-ring group flex h-11 items-center justify-center rounded-md px-[5px]"
            >
              <span
                aria-hidden="true"
                className="h-2 rounded-full transition-all duration-200 motion-reduce:transition-none"
                style={{ width: i === active ? 22 : 8, background: i === active ? "#90ecdc" : "rgba(126,166,186,.45)" }}
              />
            </button>
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
          <div key={item.key} className="flex-none" style={{ width: `min(${MOBILE_CARD}px, calc(100vw - ${MOBILE_GUTTER}px))`, scrollSnapAlign: "start" }}>
            <ServiceCard item={item} size="hero" theme="dark" showScope={false} price={prices[item.key] ?? null} className="h-[480px]" />
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
