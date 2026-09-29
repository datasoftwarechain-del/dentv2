/**
 * [042_designers] Envío de correo saliente.
 *
 * Se habla con la API HTTP de Resend directamente con fetch, sin instalar
 * el SDK: es un solo POST y evita sumar una dependencia al bundle del
 * servidor. Si mañana se cambia de proveedor, este archivo es el único
 * que se toca.
 *
 * NO lanza excepción cuando falta configuración: devuelve un resultado
 * con `ok: false` y un motivo legible. Las rutas que lo usan tienen que
 * poder responder "no se pudo enviar y este es el motivo" en vez de
 * romper con un 500 opaco.
 */

import { logger } from "@/lib/logger";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: string };

/** Está configurado el envío de correo en este entorno. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      reason:
        "El envío de correo no está configurado. Definí RESEND_API_KEY y EMAIL_FROM en el entorno del servidor.",
    };
  }

  if (input.to.length === 0) {
    return { ok: false, reason: "No hay destinatarios." };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // El cuerpo de error de Resend puede traer el email del destinatario:
      // se loguea el status y un extracto corto, nunca el payload entero.
      const detail = (await response.text()).slice(0, 200);
      logger.error("[email] Resend respondió", response.status, detail);
      return { ok: false, reason: `El proveedor de correo rechazó el envío (${response.status}).` };
    }

    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: body?.id ?? null };
  } catch (err) {
    logger.error("[email] fallo de red al enviar", err instanceof Error ? err.message : err);
    return { ok: false, reason: "No se pudo contactar al proveedor de correo." };
  }
}

/** Escapa texto para interpolarlo dentro del HTML del correo. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
