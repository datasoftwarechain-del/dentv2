/**
 * Registro de la aplicación.
 *
 * `error` y `warn` escriben SIEMPRE, también en producción. Antes toda la
 * familia estaba detrás de `NODE_ENV === "development"` y los 62 sitios que
 * llaman a logger.error no dejaban ningún rastro en producción. Eso no
 * ahorraba nada: los errores igual ocurrían, pero nadie los veía. Es la causa
 * de los fallos silenciosos que arrastró este proyecto — el aviso al cliente
 * que fallaba por una columna vacía, los 500 de la captación de leads, los
 * errores de storage. Vercel captura la salida de las funciones; suprimirla
 * era tirar el único telescopio que hay.
 *
 * `log` e `info` siguen solo en desarrollo: son ruido de depuración, no
 * señales de que algo anda mal.
 */

const isDev = process.env.NODE_ENV === "development";

function formatMsg(level: string, ...args: any[]): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === "object" && a !== null) {
        try { return JSON.stringify(a); } catch { return "[objeto no serializable]"; }
      }
      return String(a);
    })
    .join(" ")}`;
}

export const logger = {
  /** Depuración. Solo en desarrollo. */
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },

  /** Algo salió mal. SIEMPRE se registra: en producción es lo único que queda. */
  error: (...args: any[]) => {
    console.error(formatMsg("ERROR", ...args));
  },
  warn: (...args: any[]) => {
    console.warn(formatMsg("WARN", ...args));
  },

  /** Intentos de acceso no autorizado y eventos de seguridad. */
  security: (...args: any[]) => {
    console.warn(formatMsg("SECURITY", ...args));
  },
};
