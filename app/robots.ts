import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * Reemplaza a public/robots.txt, que era estático y por eso declaraba el
 * `Sitemap:` de un dominio ajeno a mano. Mismas reglas que tenía.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
