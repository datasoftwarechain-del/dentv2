// Logging utility
const isDev = process.env.NODE_ENV === "development";

function formatMsg(level: string, ...args: any[]): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`;
}

export const logger = {
  // Debug/info — only in development
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  error: (...args: any[]) => {
    if (isDev) console.error(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },

  // Security events — ALWAYS log, even in production
  // These are intentional unauthorized access attempts and security events.
  security: (...args: any[]) => {
    console.warn(formatMsg("SECURITY", ...args));
  },
};
