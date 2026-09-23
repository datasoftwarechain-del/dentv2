/**
 * [payments] Webhook de las pasarelas.
 *
 * Una ruta para todas: cada proveedor valida su propia firma y traduce
 * su notificación a la misma respuesta — esta factura se pagó, o no.
 *
 * LO ÚNICO QUE HACE ES MARCAR LA FACTURA COMO PAGA.
 * De ahí en adelante ya está resuelto en la base: el trigger
 * invoices_release_design_order (migración 037) saca la orden de
 * 'awaiting_payment' y la mete en la cola del estudio. Por eso agregar
 * una pasarela nueva no toca nada del módulo de diseño.
 *
 * SEGURIDAD
 *   - Firma validada contra el proveedor ANTES de creer nada. Sin eso,
 *     esta URL sería un botón público para marcar facturas pagadas.
 *   - Sin CSRF: los webhooks vienen de un servidor, no de un navegador.
 *     La firma cumple el mismo rol y es más fuerte.
 *   - Cliente de servicio: quien paga no tiene sesión en la app.
 *   - Idempotente: si la factura ya estaba paga no se toca, y el trigger
 *     solo dispara en la transición. Un webhook repetido no hace nada.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider, PaymentError } from "@/lib/payments";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Proveedor desconocido" }, { status: 404 });
  }

  // El cuerpo crudo hace falta tal cual para verificar la firma:
  // parsearlo y volver a serializarlo cambia bytes y la invalida.
  const rawBody = await request.text();

  let notification;
  try {
    notification = await provider.parseWebhook(request, rawBody);
  } catch (error) {
    const status = error instanceof PaymentError ? error.status : 400;
    // 401 le dice al proveedor que no reintente: la firma no va a
    // mejorar. Cualquier otro error sí merece reintento.
    return NextResponse.json({ error: "Webhook rechazado" }, { status });
  }

  // Un pago pendiente o rechazado se registra y no toca la factura.
  if (!notification.paid || !notification.invoiceId) {
    return NextResponse.json({ ok: true, ignored: notification.rawStatus });
  }

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status, total, design_order_id")
    .eq("id", notification.invoiceId)
    .maybeSingle();

  if (!invoice) {
    // 200 a propósito: la notificación llegó bien, el dato no nos
    // corresponde. Un 404 haría que el proveedor reintente para siempre.
    return NextResponse.json({ ok: true, ignored: "factura desconocida" });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ ok: true, ignored: "ya estaba paga" });
  }

  const { error: updateError } = await admin
    .from("invoices")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", invoice.id);

  if (updateError) {
    // 500 para que el proveedor reintente: el cliente pagó y la orden
    // tiene que arrancar sí o sí.
    return NextResponse.json({ error: "No se pudo registrar el pago" }, { status: 500 });
  }

  if (invoice.design_order_id) {
    await admin.from("design_order_events").insert({
      design_order_id: invoice.design_order_id,
      type: "message",
      actor_side: "system",
      message: `Pago acreditado por ${provider.info.label}. La orden entra a la cola.`,
    });
  }

  return NextResponse.json({ ok: true });
}
