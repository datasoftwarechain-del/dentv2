/**
 * [043] Token de entrega del diseñador.
 *
 * El diseñador no tiene cuenta: el token ES su credencial. De ahí las
 * tres reglas:
 *
 *   1. **En la base solo vive el hash.** Un volcado de `design_dispatches`
 *      no da acceso a ningún caso. El token en claro existe una sola vez,
 *      en memoria, mientras se arma el correo.
 *   2. **La búsqueda es POR el hash**, no una comparación fila por fila.
 *      Además de ser un índice único (rápido), no hay comparación en
 *      tiempo variable contra la que medir: para acertar un hash hay que
 *      acertar antes los 256 bits del token.
 *   3. **Un token, un caso, un diseñador.** No abre nada más. No hay
 *      sesión, no hay cookie de sesión, no hay acceso a la plataforma.
 *
 * El token viaja en la URL del correo, como cualquier enlace de
 * recuperación de contraseña. Eso significa que puede quedar en los logs
 * de acceso del hosting, así que dura poco y sirve para una sola cosa.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 bytes = 256 bits. base64url para que entre en una URL sin escapar. */
const TOKEN_BYTES = 32;

export function generarToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Comparación en tiempo constante de dos hashes.
 *
 * La búsqueda normal es por índice y no la necesita, pero cualquier
 * chequeo extra que se agregue después debe usar esto y no `===`.
 */
export function hashesIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Forma del token que llega por URL. Filtra basura antes de tocar la base. */
export function tokenTieneFormaValida(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

export function urlDeEntrega(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/d/entrega/${token}`;
}
