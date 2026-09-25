"use client";

/**
 * Arrastre con mouse + rueda para las filas con scroll horizontal.
 *
 * Con el dedo un rail de scroll-snap ya anda solo; con mouse no se podía
 * arrastrar y parecía estático. Mismo comportamiento que el export de
 * Claude Design (dragDown/dragMove/dragUp/wheelX):
 *   - click + arrastre mueve la fila; al soltar, la card queda centrada
 *     en su lugar (se apaga el snap mientras se arrastra y se vuelve a
 *     encender después del scrollTo suave)
 *   - la rueda vertical también la mueve hacia los costados
 *   - si hubo arrastre real (> 3px), se traga el click siguiente para
 *     no disparar el CTA de la card sin querer
 * Solo actúa con pointerType 'mouse': el touch sigue siendo nativo.
 */

import { useCallback, useRef, type PointerEvent, type WheelEvent } from "react";

interface DragState {
  el: HTMLElement;
  x: number;
  start: number;
  moved: boolean;
}

export function useDragScroll(step: number) {
  const drag = useRef<DragState | null>(null);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    drag.current = { el, x: e.clientX, start: el.scrollLeft, moved: false };
    el.style.scrollSnapType = "none";
    el.style.cursor = "grabbing";
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.el !== e.currentTarget) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    d.el.scrollLeft = d.start - dx;
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const el = d.el;
    el.style.cursor = "grab";
    const i = Math.round(el.scrollLeft / step);
    el.scrollTo({ left: i * step, behavior: "smooth" });
    window.setTimeout(() => { el.style.scrollSnapType = "x mandatory"; }, 400);
    if (d.moved) {
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener("click", stop, { capture: true, once: true });
    }
  }, [step]);

  const onWheel = useCallback((e: WheelEvent<HTMLElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.currentTarget.scrollLeft += e.deltaY;
      e.stopPropagation();
    }
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
    /** cursor:grab + touch nativo + sin selección de texto al arrastrar */
    className: "cursor-grab select-none [touch-action:pan-x_pan-y]",
  };
}
