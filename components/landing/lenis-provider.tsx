"use client";

/**
 * Único límite de cliente que envuelve toda la landing. Acá viven las dos
 * cosas que tienen que valer para TODAS las secciones:
 *
 *  - El scroll suave de Lenis.
 *  - `MotionConfig reducedMotion="user"`: con esto Framer Motion ignora
 *    `x`/`y`/`scale`/`rotate` cuando el sistema pide menos movimiento, y
 *    conserva `opacity`. Sin esto, `ScrollSection` deslizaba las diez
 *    secciones con `y: 32` aunque el usuario hubiera pedido lo contrario:
 *    las clases `motion-reduce:` de Tailwind solo alcanzan a las
 *    transiciones CSS, nunca a Framer Motion.
 *
 * Lenis también mueve la página por su cuenta, así que se apaga con la
 * misma preferencia: un scroll con inercia es movimiento vestibular igual
 * que una sección que se desliza.
 */

import { useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";
import { MotionConfig } from "framer-motion";

function usePrefersReducedMotion(): boolean {
  // Arranca en false para que servidor y cliente pinten lo mismo; se corrige
  // apenas hidrata. Un flash de scroll suave es preferible a un error de
  // hidratación.
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduce;
}

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <ReactLenis root options={{ smoothWheel: !reduceMotion, duration: reduceMotion ? 0 : undefined }}>
        {children}
      </ReactLenis>
    </MotionConfig>
  );
}
