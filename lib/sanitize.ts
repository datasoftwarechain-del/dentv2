/**
 * DOMPurify wrappers for sanitizing user-generated content.
 * Only runs in browser context (DOMPurify requires DOM API).
 */

/**
 * Sanitizes HTML allowing only safe inline tags.
 * Use for rich-text content that may contain basic formatting.
 */
export async function sanitizeHTML(dirty: string): Promise<string> {
  if (typeof window === "undefined") return dirty;
  const { default: DOMPurify } = await import("dompurify");
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "li", "ol"],
    ALLOWED_ATTR: [],
  }) as string;
}

/**
 * Strips all HTML from a string, returning plain text only.
 * Use for notes, descriptions, and any field displayed as plain text.
 */
export function sanitizeText(dirty: string): string {
  if (typeof window === "undefined") return dirty;
  const div = document.createElement("div");
  div.textContent = dirty;
  return div.innerHTML
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
