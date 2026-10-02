/**
 * Imagen que se ve al compartir el link (WhatsApp, LinkedIn, Twitter).
 *
 * Antes la metadata apuntaba a `/og-image.png`, un archivo que NO existe:
 * daba 404 tanto en el deploy propio como en digitaldent.app, así que todo
 * link compartido salía sin imagen. Se genera acá en vez de depender de un
 * PNG suelto: así vale para cualquier dominio y no se puede volver a romper
 * por un archivo que alguien no subió.
 *
 * Colores del sistema: --primary 196 92% 20% y --accent 175 75% 59%.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DigitalDent — Plataforma de odontología digital";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #044c64 0%, #0a3444 55%, #06252f 100%)",
          color: "#f4fdfd",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#43eada",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
              color: "#044c64",
            }}
          >
            D
          </div>
          {/* Satori exige `display` explícito en todo div con más de un hijo
              y no interpreta <br/>: por eso cada línea es su propia fila. */}
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            <span>Digital</span>
            <span style={{ color: "#43eada" }}>Dent</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#43eada",
              fontWeight: 600,
            }}
          >
            Research &amp; Innovation in digital Dentistry
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>
            <span>Del escaneo</span>
            <span style={{ color: "#43eada" }}>al trabajo final.</span>
          </div>
        </div>

        <div style={{ fontSize: 26, color: "#9fc4d2" }}>
          Diseño CAD online · Fresado e impresión en Uruguay · Software para clínicas y laboratorios
        </div>
      </div>
    ),
    size,
  );
}
