/**
 * [044] Aviso al cliente de que su diseño está listo para revisar.
 *
 * A diferencia del correo al diseñador, este NO lleva archivos ni enlaces
 * firmados: el cliente TIENE cuenta y entra a la plataforma. Así el aviso
 * no hereda la excepción de 72 h de CASE_EMAIL_LINK_TTL_SECONDS y los
 * escaneos siguen sirviéndose con URLs de 5 minutos detrás de sesión.
 *
 * Tampoco dice "descargá el STL": el entregable se libera recién cuando el
 * cliente APRUEBA (ver el paso 6 de /api/design/orders/[id]/status). Si el
 * correo prometiera la descarga, el cliente entraría, no la encontraría y
 * escribiría. Promete lo que hay: revisar y aprobar.
 */

import { escapeHtml } from "@/lib/email";

export interface ClientEmailInput {
  orderNumber: string;
  patientRef: string | null;
  studioName: string;
  clientName: string;
  /** Enlace a la orden dentro de la plataforma. */
  orderUrl: string;
  /** Cuántas veces se rehízo. 0 = primera entrega. */
  revisionCount: number;
}

export function buildClientReadyEmail(
  input: ClientEmailInput,
): { subject: string; text: string; html: string } {
  const esRevision = input.revisionCount > 0;
  const subject = esRevision
    ? `${input.orderNumber} · revisión lista para revisar`
    : `${input.orderNumber} · tu diseño está listo para revisar`;

  const encabezado = esRevision
    ? `${input.studioName} subió una versión corregida de ${input.orderNumber}.`
    : `${input.studioName} terminó el diseño de ${input.orderNumber}.`;

  const text = [
    `Hola ${input.clientName},`,
    "",
    encabezado,
    "",
    `Referencia del caso: ${input.patientRef || "sin referencia"}`,
    "",
    "Entrá a la plataforma para verlo y aprobarlo o pedir cambios:",
    input.orderUrl,
    "",
    "El archivo para imprimir o fresar queda disponible cuando apruebes el diseño.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f6f8f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
      <span style="font-size:18px;font-weight:700;color:#044c64;">Digital</span><span style="font-size:18px;font-weight:700;color:#09919b;">Dent</span>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;">Hola ${escapeHtml(input.clientName)},</p>
      <p style="margin:0 0 20px;">${escapeHtml(encabezado)}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;">Caso</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(input.orderNumber)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Referencia</td><td style="padding:6px 0;text-align:right;">${escapeHtml(input.patientRef || "sin referencia")}</td></tr>
      </table>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(input.orderUrl)}" style="display:inline-block;background:#09919b;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">Ver el diseño</a>
      </p>
      <p style="margin:0;font-size:13px;color:#64748b;">
        El archivo para imprimir o fresar queda disponible cuando apruebes el diseño.
      </p>
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}
