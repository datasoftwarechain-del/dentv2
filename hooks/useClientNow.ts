"use client";

import { useEffect, useState } from "react";

/**
 * "Ahora", pero solo después de hidratar.
 *
 * Llamar a Date.now() durante el render rompe la hidratación: el servidor
 * evalúa en un instante y el cliente en otro, así que un vencimiento que
 * cae justo en el medio se renderiza distinto en cada lado y React aborta.
 *
 * Devuelve null en el render del servidor y en el primero del cliente —
 * los dos pintan igual — y el momento real después. Lo que dependa del
 * reloj tiene que tratar null como "todavía no sé", no como cero.
 */
export function useClientNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}
