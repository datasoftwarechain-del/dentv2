/**
 * Origen público del sitio, en un solo lugar.
 *
 * `https://digitaldent.app` NO es de este proyecto: sirve una DigitalDent
 * alemana ("Die digitale Arbeitsplattform für Dentallabore"), verificado el
 * 2026-10-01, 10-02 y 10-05. Estuvo firmando `metadataBase`, `og:url`, el
 * `canonical`, el sitemap y el `Sitemap:` de robots.txt — o sea que cada
 * página de acá le atribuía su contenido al sitio de otro.
 *
 * Orden de resolución, de más explícito a más automático:
 *   1. `NEXT_PUBLIC_SITE_URL` — la que el owner ponga en Vercel. Es la misma
 *      variable que usan los enlaces de los correos.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — la pone Vercel sola y apunta al
 *      dominio de producción del proyecto. Si mañana se compra un dominio y
 *      se lo asigna como dominio de producción, el metadata lo sigue sin
 *      tocar código.
 *   3. El host real de hoy, que es el que responde 200.
 *
 * Ojo: `dentv2.vercel.app` (sin el `v0-`) es OTRA app, "Smart DentalOps".
 */
const FALLBACK = "https://v0-dentv2.vercel.app";

function normalize(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  // Vercel entrega el host pelado, sin protocolo.
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    // `origin` descarta path, query y la barra final, que en un canonical
    // duplicado se cobra caro.
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

export const SITE_URL =
  normalize(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  FALLBACK;
