/**
 * [043] Política del reparto automático.
 *
 * Todos los tiempos del bot viven acá, en un solo archivo, para poder
 * moverlos sin buscarlos por el código. Las decisiones y el porqué de
 * cada número están en PLAN_BOT_DISENADORES.md, sección 5.
 */

const HORA = 60 * 60 * 1000;

/** Plazo para ACEPTAR el caso. Vencido, el despacho muere y se re-reparte. */
export const ACEPTAR_MS = 48 * HORA;

/** Recordatorio si no aceptó. */
export const RECORDATORIO_MS = 24 * HORA;

/**
 * Los urgentes corren con la mitad de los tiempos: 12 h de recordatorio,
 * 24 h de vencimiento.
 */
export const FACTOR_URGENTE = 0.5;

/**
 * Colchón sobre la fecha límite del caso una vez que el diseñador aceptó.
 * Necesita el enlace todo el tiempo que dure el trabajo, no solo 48 h.
 */
export const COLCHON_TRAS_ACEPTAR_MS = 48 * HORA;

/** Techo duro cuando la orden no tiene fecha límite. Ningún token vive más. */
export const MAXIMO_TRAS_ACEPTAR_MS = 14 * 24 * HORA;

/**
 * Intentos por caso antes de cortar el reparto automático.
 *
 * Sin este corte, un caso que nadie puede tomar (porque le falta un
 * archivo, por ejemplo) rota entre todos los diseñadores mandando correos
 * para siempre.
 */
export const MAX_INTENTOS = 3;

export type Prioridad = "normal" | "urgent";

function factor(prioridad: Prioridad): number {
  return prioridad === "urgent" ? FACTOR_URGENTE : 1;
}

/** Cuándo vence el token recién emitido (todavía sin aceptar). */
export function vencimientoParaAceptar(prioridad: Prioridad, desde: Date = new Date()): Date {
  return new Date(desde.getTime() + ACEPTAR_MS * factor(prioridad));
}

/** Cuándo mandar el recordatorio de un despacho que sigue sin aceptar. */
export function momentoDelRecordatorio(prioridad: Prioridad, enviadoEn: Date): Date {
  return new Date(enviadoEn.getTime() + RECORDATORIO_MS * factor(prioridad));
}

/**
 * Nuevo vencimiento una vez que aceptó.
 *
 * Con fecha límite: la fecha límite más el colchón. Sin fecha límite: el
 * techo duro. Nunca se acorta un token ya emitido, así que si la fecha
 * límite ya pasó se usa el techo igual.
 */
export function vencimientoTrasAceptar(dueAt: string | null, desde: Date = new Date()): Date {
  const techo = new Date(desde.getTime() + MAXIMO_TRAS_ACEPTAR_MS);
  if (!dueAt) return techo;

  const limite = new Date(dueAt);
  if (Number.isNaN(limite.getTime())) return techo;

  const conColchon = new Date(limite.getTime() + COLCHON_TRAS_ACEPTAR_MS);
  // El que quede más lejos, pero nunca más allá del techo.
  const elegido = conColchon.getTime() > desde.getTime() ? conColchon : techo;
  return elegido.getTime() > techo.getTime() ? techo : elegido;
}

/** ¿Este caso ya agotó los intentos automáticos? */
export function agotoIntentos(intento: number): boolean {
  return intento >= MAX_INTENTOS;
}
