/**
 * Limpieza de texto entrado por el usuario.
 *
 * HISTORIA, porque explica por qué esto está escrito así:
 *
 *   `sanitizeText` ESCAPABA el texto y acto seguido lo DES-ESCAPABA
 *   (`&lt;` → `<`, `&gt;` → `>`), así que devolvía la entrada intacta:
 *   `sanitizeText("<script>alert(1)</script>")` salía idéntico. Era una
 *   función de seguridad que no hacía absolutamente nada, y las dos
 *   devolvían `dirty` sin tocar cuando corrían en el servidor.
 *
 *   No tenían ni un consumidor, así que no hubo consecuencias — pero una
 *   función que promete limpiar y no limpia es peor que no tenerla: el
 *   próximo que la use va a confiar.
 *
 * React ya escapa todo lo que interpola, así que la defensa principal
 * sigue siendo no usar `dangerouslySetInnerHTML`. Esto es para lo que sale
 * de React: un PDF, un asunto de correo, un CSV, un `title=`.
 */

/** Entidades HTML básicas → carácter. Lo mínimo que aparece en texto real. */
const ENTIDADES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

/**
 * Devuelve TEXTO PLANO: sin etiquetas, sin comentarios y sin entidades.
 *
 * Funciona igual en servidor y navegador a propósito — la versión anterior
 * dependía del DOM y en el servidor no hacía nada, que es justo donde se
 * arma un PDF o un correo.
 */
export function sanitizeText(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return String(dirty)
    // Primero el contenido de script/style entero: si solo se quitaran las
    // etiquetas, el cuerpo del script quedaría como texto visible.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-zA-Z#0-9]+;/g, (e) => ENTIDADES[e.toLowerCase()] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * HTML con formato básico permitido, para texto enriquecido.
 *
 * En el servidor devuelve texto plano en vez de la entrada sin tocar:
 * falla CERRADO. Antes devolvía `dirty` tal cual, que es lo contrario de
 * lo que tiene que hacer una función de saneamiento cuando no puede operar.
 */
export async function sanitizeHTML(dirty: string | null | undefined): Promise<string> {
  if (!dirty) return "";
  if (typeof window === "undefined") return sanitizeText(dirty);
  const { default: DOMPurify } = await import("dompurify");
  return DOMPurify.sanitize(String(dirty), {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "li", "ol"],
    ALLOWED_ATTR: [],
  }) as string;
}
