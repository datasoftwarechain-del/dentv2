/**
 * [046] El disparador del reparto automático.
 *
 * Dos vías, a propósito redundantes, porque fallan distinto:
 *
 *   - **Webhook de base de datos.** `POST { order_id }` cuando una orden
 *     entra a 'submitted'. Es inmediato.
 *   - **Barrido por cron.** `GET` cada 10 minutos: vence los despachos sin
 *     respuesta, manda recordatorios y reparte todo lo que quedó sin
 *     despachar. Cubre el webhook perdido, el deploy caído y el caso que
 *     entró por SQL. Es GET porque los cron de Vercel solo hacen GET.
 *
 * Correrlas juntas es inofensivo: el índice único parcial de
 * design_dispatches hace que el segundo intento choque y no mande nada.
 *
 * AUTENTICACIÓN: secreto compartido en cabecera, comparado en tiempo
 * constante. NO lleva CSRF, igual que los webhooks de pago: lo llama un
 * servidor, no un navegador.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { despacharCaso, vencerDespachosVencidos, enviarRecordatorios } from "@/lib/design/dispatch/run";

const BodySchema = z.object({
  order_id: z.string().uuid().nullish(),
});

/** Comparación en tiempo constante que no filtra la longitud del secreto. */
function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.BOT_WEBHOOK_SECRET?.trim();
  if (!esperado || !recibido) return false;

  const a = Buffer.from(recibido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Puerta común a las dos vías. Devuelve la respuesta de rechazo o null. */
function rechazar(request: NextRequest): NextResponse | null {
  // Interruptor general: cuando algo salga mal a las once de la noche hay
  // que poder apagar el bot sin un deploy.
  if (process.env.BOT_DISPATCH_ENABLED === "false") {
    return NextResponse.json({ error: "El reparto automático está apagado." }, { status: 503 });
  }

  const cabecera =
    request.headers.get("x-bot-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!secretoValido(cabecera)) {
    // Sin pistas sobre si falta el secreto del servidor o vino mal el de
    // quien llama: las dos cosas son 401 a secas.
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}

/** POST — una orden concreta. La llama el webhook de base de datos. */
export async function POST(request: NextRequest) {
  const denegado = rechazar(request);
  if (denegado) return denegado;

  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;

  const { data: body, error } = await validateBody(request, BodySchema);
  if (error) return error;
  if (!body.order_id) {
    return NextResponse.json({ error: "Falta order_id." }, { status: 400 });
  }

  const resultado = await despacharCaso(admin, { orderId: body.order_id, baseUrl });
  // 'ya_despachado' no es un error: es el webhook y el cron cruzándose.
  // Responder 200 evita que el emisor lo reintente en bucle.
  const status = resultado.ok || resultado.codigo === "ya_despachado" ? 200 : 422;
  return NextResponse.json({ data: resultado }, { status });
}

/** GET — el barrido. La llama el cron de Vercel, que solo hace GET. */
export async function GET(request: NextRequest) {
  const denegado = rechazar(request);
  if (denegado) return denegado;

  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;

  const vencidos = await vencerDespachosVencidos(admin);
  const recordados = await enviarRecordatorios(admin, baseUrl);

  // Órdenes listas para repartir y sin despacho abierto. Se traen los ids
  // ocupados y se filtra en memoria: son decenas, no millones.
  const { data: ocupados } = await admin
    .from("design_dispatches")
    .select("design_order_id")
    .in("status", ["sent", "accepted"]);
  const ocupadas = new Set((ocupados ?? []).map((d) => d.design_order_id as string));

  const { data: candidatas } = await admin
    .from("design_orders")
    .select("id")
    .eq("status", "submitted")
    .order("created_at", { ascending: true })
    .limit(50);

  const pendientes = (candidatas ?? []).filter((o) => !ocupadas.has(o.id as string));

  const despachadas: string[] = [];
  const sinRepartir: Array<{ order_id: string; motivo: string }> = [];

  for (const o of pendientes) {
    const r = await despacharCaso(admin, { orderId: o.id as string, baseUrl });
    if (r.ok) despachadas.push(r.disenador);
    else if (r.codigo !== "ya_despachado") sinRepartir.push({ order_id: o.id as string, motivo: r.motivo });
  }

  logger.info(
    "[bot] barrido:", vencidos, "vencidos,", recordados, "recordatorios,",
    despachadas.length, "despachadas,", sinRepartir.length, "sin repartir",
  );

  return NextResponse.json({
    data: {
      vencidos,
      recordatorios: recordados,
      despachadas: despachadas.length,
      sin_repartir: sinRepartir,
    },
  });
}
