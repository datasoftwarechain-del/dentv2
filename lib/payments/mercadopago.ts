/**
 * [payments] Mercado Pago — el cobro en la región.
 *
 * Cubre lo que PayPal no hace bien acá: cobrarle en pesos a un cliente
 * local, con los medios que esa persona ya usa. Para el odontólogo de
 * Inglaterra no sirve; para el de Montevideo es el único que sirve.
 *
 * API REST directa, sin SDK: son dos llamadas (crear preferencia,
 * consultar pago).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentProvider, PaymentRequest, PaymentSession, PaymentNotification,
} from "./types";
import { PaymentError } from "./types";

const API = "https://api.mercadopago.com";

function accessToken(): string | null {
  return process.env.MERCADOPAGO_ACCESS_TOKEN ?? null;
}

export const mercadopagoProvider: PaymentProvider = {
  info: {
    id: "mercadopago",
    label: "Pagar con Mercado Pago",
    hint: "Tarjeta, débito o dinero en cuenta. Para clientes de la región.",
    currencies: ["UYU", "ARS", "USD", "BRL", "CLP", "MXN", "COP", "PEN"],
  },

  isConfigured() {
    return accessToken() !== null;
  },

  async createSession(request: PaymentRequest): Promise<PaymentSession> {
    const token = accessToken();
    if (!token) throw new PaymentError("Mercado Pago no está configurado", 503);

    const response = await fetch(`${API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Dos clics en "pagar" no generan dos preferencias.
        "X-Idempotency-Key": request.invoiceId,
      },
      body: JSON.stringify({
        items: [{
          id: request.invoiceNumber,
          title: request.description.slice(0, 250),
          quantity: 1,
          currency_id: request.currency,
          unit_price: Number(request.amount.toFixed(2)),
        }],
        // Vuelve en el webhook: es cómo se sabe qué factura se pagó.
        external_reference: request.invoiceId,
        payer: request.payerEmail ? { email: request.payerEmail } : undefined,
        back_urls: {
          success: request.returnUrl,
          pending: request.returnUrl,
          failure: request.cancelUrl,
        },
        auto_return: "approved",
        // El diseño no empieza hasta que el dinero esté acreditado, así
        // que no tiene sentido ofrecer medios que tardan días en
        // confirmarse y dejan al cliente esperando sin saber por qué.
        payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new PaymentError(data?.message ?? "Mercado Pago no pudo crear el pago");
    }

    const url = process.env.MERCADOPAGO_ENV === "live" ? data.init_point : data.sandbox_init_point;
    if (!url) throw new PaymentError("Mercado Pago no devolvió el enlace de pago");

    return { provider: "mercadopago", checkoutUrl: url, externalId: String(data.id) };
  },

  async parseWebhook(request: Request, rawBody: string): Promise<PaymentNotification> {
    const token = accessToken();
    if (!token) throw new PaymentError("Mercado Pago no está configurado", 503);

    verifySignature(request);

    // La notificación solo trae el id del pago; el estado real se
    // consulta a la API. Confiar en el cuerpo del POST sería confiar en
    // quien lo mandó.
    const body = JSON.parse(rawBody || "{}");
    const paymentId = body?.data?.id ?? new URL(request.url).searchParams.get("data.id");

    if (!paymentId) {
      return { paid: false, invoiceId: null, externalId: null, rawStatus: "sin id de pago" };
    }

    const lookup = await fetch(`${API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payment = await lookup.json();

    if (!lookup.ok) {
      throw new PaymentError(payment?.message ?? "No se pudo consultar el pago");
    }

    return {
      paid: payment?.status === "approved",
      invoiceId: payment?.external_reference ?? null,
      externalId: String(payment?.id ?? paymentId),
      rawStatus: `${payment?.status ?? "?"}/${payment?.status_detail ?? "?"}`,
    };
  },
};

/**
 * Valida la firma `x-signature`.
 *
 * Mercado Pago firma `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * con HMAC-SHA256 y el secreto del webhook. Sin esta validación, la URL
 * del webhook es un botón público para marcar facturas como pagadas.
 */
function verifySignature(request: Request): void {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new PaymentError(
      "Falta MERCADOPAGO_WEBHOOK_SECRET: sin eso no se puede validar la firma",
      503,
    );
  }

  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!signature) throw new PaymentError("Webhook sin firma", 401);

  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) throw new PaymentError("Firma de webhook mal formada", 401);

  const dataId = new URL(request.url).searchParams.get("data.id") ?? "";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hash, "utf8");
  // Comparación de tiempo constante: comparar con === filtra información
  // sobre el hash correcto a través de cuánto tarda en fallar.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new PaymentError("Firma de webhook inválida", 401);
  }
}
