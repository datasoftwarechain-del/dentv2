/**
 * La versión anterior de sanitizeText escapaba y después des-escapaba, así
 * que devolvía la entrada intacta. Estos tests existen para que eso no
 * pueda volver a pasar sin que algo se ponga rojo.
 */

import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeHTML } from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("vacío, null y undefined devuelven cadena vacía", () => {
    expect(sanitizeText("")).toBe("");
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });

  it("el texto normal pasa tal cual", () => {
    expect(sanitizeText("Corona de zirconio 1.6")).toBe("Corona de zirconio 1.6");
  });

  it("EL BUG QUE HABÍA: un script no puede salir igual que como entró", () => {
    const dirty = "<script>alert(1)</script>";
    const out = sanitizeText(dirty);
    expect(out).not.toBe(dirty);
    expect(out).not.toContain("<");
    expect(out).not.toContain("alert");
  });

  it("quita el cuerpo del script, no solo las etiquetas", () => {
    // No hay espacio entre "antes" y "después" en la entrada, así que
    // tampoco lo hay en la salida: lo que desaparece es el script entero.
    expect(sanitizeText("antes<script>robar()</script>después")).toBe("antesdespués");
  });

  it("quita el cuerpo del style", () => {
    expect(sanitizeText("a<style>body{display:none}</style>b")).toBe("ab");
  });

  it("un img con onerror queda sin nada ejecutable", () => {
    const out = sanitizeText('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<");
  });

  it("conserva el texto y descarta el marcado", () => {
    expect(sanitizeText("<b>Perno</b> muñon")).toBe("Perno muñon");
  });

  it("quita comentarios HTML", () => {
    expect(sanitizeText("a<!-- oculto -->b")).toBe("ab");
  });

  it("decodifica las entidades básicas", () => {
    expect(sanitizeText("Pedro &amp; Juan")).toBe("Pedro & Juan");
    expect(sanitizeText("&quot;cita&quot;")).toBe('"cita"');
  });

  it("no deja entidades desconocidas colgando", () => {
    expect(sanitizeText("a&zzzz;b")).toBe("ab");
  });

  it("colapsa espacios y recorta", () => {
    expect(sanitizeText("  hola   \n  mundo  ")).toBe("hola mundo");
  });

  it("una etiqueta mal cerrada no deja pasar el resto", () => {
    expect(sanitizeText("<div class='x'>texto")).toBe("texto");
  });
});

describe("sanitizeHTML", () => {
  it("en el servidor FALLA CERRADO: devuelve texto plano, no la entrada", async () => {
    // Los tests corren en node, así que window es undefined: es el camino
    // de servidor. Antes esta rama devolvía `dirty` sin tocar.
    const out = await sanitizeHTML("<script>alert(1)</script><b>hola</b>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("hola");
  });

  it("vacío devuelve vacío", async () => {
    expect(await sanitizeHTML("")).toBe("");
    expect(await sanitizeHTML(null)).toBe("");
  });
});
