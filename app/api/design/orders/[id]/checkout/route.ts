/**
 * [payments] Inicia el pago de una orden de diseño.
 *
 * GET  — qué pasarelas hay disponibles para esta orden.
 * POST — crea la sesión de pago y devuelve a dónde mandar al cliente.
 *
 * El monto NO se acepta del cliente: sale de la factura que emitió el
 * trigger al pasar la orden a 'awaiting_payment'. Dejar que el navegador
 * proponga cuánto pagar es como se termina cobrando un dólar por un
 * All-on-X.
 */

import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { resolveDesignAccess } from "@/lib/design/access";
import { availableProviders, getProvider, PaymentError } from "@/lib/payments";
import { canViewPrices } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CheckoutSchema = z.object({
  provider: z.enum(["paypal", "mercadopago"]),
});

/** Moneda de las órdenes de diseño. Ver lib/money.ts. */
const CURRENCY = "USD";

async function loadInvoice(orderId: string) {
  const { access, error } = await resolveDesignAccess(orderId);
  if (error) return { error };

  if (access.order.status !== "awaiting_payment") {
    return {
      error: {
        message:
          access.order.status === "draft"
            ? "Enviá la orden antes de pagarla."
            : "Esta orden no está pendiente de pago.",
        status: 409,
      },
    };
  }
  if (!access.order.invoice_id) {
    return { error: { message: "La factura todavía se está generando. Reintentá en unos segundos.", status: 425 } };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, status")
    .eq("id", access.order.invoice_id)
    .maybeSingle();

  if (!invoice) return { error: { message: "No se encontró la factura", status: 404 } };
  if (invoice.status === "paid") {
    return { error: { message: "Esta orden ya está paga.", status: 409 } };
  }
  if (!(Number(invoice.total) > 0)) {
    // Una factura en cero significa aranceles sin precio cargado. Mandar
    // al cliente a pagar $0 lo deja en un checkout roto sin explicación.
    return {
      error: {
        message: "El total de la orden es cero. El estudio tiene que cargar los precios antes de cobrarla.",
        status: 409,
      },
    };
  }

  return { access, invoice };
}

/** GET — pasarelas disponibles y el total a pagar. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadInvoice(id);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status });
    }

    // Del lado del estudio, el importe es información financiera: un
    // colaborador sin view_prices recibe la factura sin el monto. El
    // cliente siempre lo ve, porque es lo que tiene que pagar.
    const { access } = result;
    const canSeeAmount = access.side === "client" || canViewPrices(access.permissions);

    return NextResponse.json({
      data: {
        amount: canSeeAmount ? Number(result.invoice.total) : null,
        currency: CURRENCY,
        invoice_number: result.invoice.invoice_number,
        providers: availableProviders(CURRENCY),
      },
    });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** POST — crea la sesión y devuelve la URL del checkout. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;

    const { data: body, error: bodyError } = await validateBody(request, CheckoutSchema);
    if (bodyError) return bodyError;

    const result = await loadInvoice(id);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status });
    }

    const provider = getProvider(body.provider);
    if (!provider?.isConfigured()) {
      return NextResponse.json(
        { error: "Esa forma de pago no está disponible en este momento." },
        { status: 503 },
      );
    }

    const origin = request.nextUrl.origin;
    const session = await provider.createSession({
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoice_number,
      amount: Number(result.invoice.total),
      currency: CURRENCY,
      description: `Diseño CAD/CAM · orden ${result.access.order.order_number}`,
      returnUrl: `${origin}/dashboard/design/${id}?pago=ok`,
      cancelUrl: `${origin}/dashboard/design/${id}?pago=cancelado`,
    });

    // Queda asentado quién inició el pago y por dónde. Si el webhook no
    // llega, esto es lo que permite reconstruir qué pasó.
    const supabase = await createClient();
    await supabase.from("design_order_events").insert({
      design_order_id: id,
      type: "message",
      actor_side: result.access.side,
      actor_id: result.access.userId,
      message: `Pago iniciado por ${provider.info.label} (ref. ${session.externalId}).`,
      is_internal: true,
    });

    return NextResponse.json({ data: session });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
