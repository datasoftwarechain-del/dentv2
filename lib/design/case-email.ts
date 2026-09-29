/**
 * [042_designers] Armado del correo con el caso para el diseñador.
 *
 * Separado de la ruta para poder probarlo sin HTTP y para que el bot que
 * automatice el reparto reutilice exactamente el mismo cuerpo.
 *
 * PRIVACIDAD: el correo lleva la referencia del caso (patient_ref), nunca
 * el nombre del paciente. Es la misma regla que ya aplica el alta pública.
 */

import { escapeHtml } from "@/lib/email";

/** Vida de los enlaces de descarga que viajan por correo.
 *
 * El resto del módulo firma URLs a 5 minutos (SIGNED_URL_TTL_SECONDS) porque
 * el que descarga está mirando la pantalla. Acá el destinatario NO tiene
 * cuenta y puede abrir el correo horas después, así que se firma a 72 h.
 * Es una excepción deliberada y acotada: cuando los diseñadores tengan
 * cuenta, esto vuelve a enlaces cortos detrás de sesión.
 */
export const CASE_EMAIL_LINK_TTL_SECONDS = 72 * 60 * 60;

export interface CaseEmailItem {
  description: string | null;
  service_code: string | null;
  quantity: number | null;
  tooth_positions: string[] | null;
  arch: string | null;
  notes: string | null;
}

export interface CaseEmailFile {
  file_name: string;
  url: string | null;
}

export interface CaseEmailInput {
  orderNumber: string;
  patientRef: string | null;
  caseNotes: string | null;
  priority: string | null;
  dueAt: string | null;
  items: CaseEmailItem[];
  files: CaseEmailFile[];
  studioName: string;
  designerName: string;
  /** [043] Portal de entrega con token. El diseñador acepta y sube ahí. */
  deliveryUrl: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "sin fecha límite";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha límite";
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function describeItem(item: CaseEmailItem): string {
  const parts: string[] = [];
  parts.push(item.description?.trim() || item.service_code || "Trabajo de diseño");
  if (item.quantity && item.quantity > 1) parts.push(`×${item.quantity}`);
  if (item.tooth_positions?.length) parts.push(`piezas ${item.tooth_positions.join(", ")}`);
  if (item.arch) parts.push(item.arch);
  if (item.notes?.trim()) parts.push(item.notes.trim());
  return parts.join(" · ");
}

export function buildCaseEmail(input: CaseEmailInput): { subject: string; text: string; html: string } {
  const subject = `${input.orderNumber} · caso de diseño asignado`;
  const due = formatDate(input.dueAt);
  const items = input.items.map(describeItem);
  const withUrl = input.files.filter((f) => f.url);
  const withoutUrl = input.files.filter((f) => !f.url);

  const textLines = [
    `Hola ${input.designerName},`,
    "",
    `${input.studioName} te asignó el caso ${input.orderNumber}.`,
    "",
    `Referencia del caso: ${input.patientRef || "sin referencia"}`,
    `Prioridad: ${input.priority || "normal"}`,
    `Fecha límite: ${due}`,
    "",
    "Trabajo:",
    ...(items.length ? items.map((i) => `  - ${i}`) : ["  - sin detalle cargado"]),
  ];

  if (input.caseNotes?.trim()) {
    textLines.push("", "Notas del caso:", input.caseNotes.trim());
  }

  if (withUrl.length) {
    textLines.push("", "Archivos (los enlaces vencen en 72 horas):");
    for (const f of withUrl) textLines.push(`  - ${f.file_name}: ${f.url}`);
  }
  if (withoutUrl.length) {
    textLines.push(
      "",
      `Hay ${withoutUrl.length} archivo(s) que no se pudieron enlazar. Pedilos al estudio.`,
    );
  }

  textLines.push(
    "",
    "Para aceptar el caso y subir el diseño terminado, entrá acá:",
    input.deliveryUrl,
    "",
    "El enlace es solo tuyo y para este caso. No subas el diseño por correo:",
    "los archivos pesados no entran como adjunto.",
  );

  const li = (s: string) => `<li style="margin:4px 0;">${escapeHtml(s)}</li>`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f6f8f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
      <span style="font-size:18px;font-weight:700;color:#044c64;">Digital</span><span style="font-size:18px;font-weight:700;color:#09919b;">Dent</span>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;">Hola ${escapeHtml(input.designerName)},</p>
      <p style="margin:0 0 20px;">${escapeHtml(input.studioName)} te asignó el caso <strong>${escapeHtml(input.orderNumber)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;">Referencia</td><td style="padding:6px 0;text-align:right;">${escapeHtml(input.patientRef || "sin referencia")}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Prioridad</td><td style="padding:6px 0;text-align:right;">${escapeHtml(input.priority || "normal")}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Fecha límite</td><td style="padding:6px 0;text-align:right;">${escapeHtml(due)}</td></tr>
      </table>
      <h2 style="margin:0 0 8px;font-size:15px;">Trabajo</h2>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;">
        ${items.length ? items.map(li).join("") : li("sin detalle cargado")}
      </ul>
      ${
        input.caseNotes?.trim()
          ? `<h2 style="margin:0 0 8px;font-size:15px;">Notas del caso</h2><p style="margin:0 0 20px;font-size:14px;white-space:pre-wrap;">${escapeHtml(input.caseNotes.trim())}</p>`
          : ""
      }
      ${
        withUrl.length
          ? `<h2 style="margin:0 0 8px;font-size:15px;">Archivos</h2><ul style="margin:0 0 8px;padding-left:20px;font-size:14px;">${withUrl
              .map(
                (f) =>
                  `<li style="margin:4px 0;"><a href="${escapeHtml(f.url as string)}" style="color:#09919b;">${escapeHtml(f.file_name)}</a></li>`,
              )
              .join("")}</ul><p style="margin:0 0 20px;font-size:12px;color:#64748b;">Los enlaces vencen en 72 horas.</p>`
          : ""
      }
      ${
        withoutUrl.length
          ? `<p style="margin:0 0 20px;font-size:13px;color:#b45309;">Hay ${withoutUrl.length} archivo(s) que no se pudieron enlazar. Pedilos al estudio.</p>`
          : ""
      }
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(input.deliveryUrl)}" style="display:inline-block;background:#09919b;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">Aceptar y subir el diseño</a>
      </p>
      <p style="margin:0;font-size:13px;color:#64748b;">
        El enlace es solo tuyo y para este caso. No subas el diseño por correo: los archivos pesados no entran como adjunto.
      </p>
    </div>
  </div>
</body></html>`;

  return { subject, text: textLines.join("\n"), html };
}
