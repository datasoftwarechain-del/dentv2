/**
 * [payments] PayPal — el cobro internacional.
 *
 * Es la vía para el cliente de afuera que paga en dólares, que es
 * justamente el que Stripe no puede atender desde acá.
 *
 * Se usa la API REST directa en vez del SDK: son tres llamadas (token,
 * crear orden, capturar) y el SDK traería una dependencia entera para
 * envolverlas.
 *
 * NOTA OPERATIVA para Uruguay: PayPal cobra sin problemas, pero el
 * retiro no va directo al banco — pasa por un socio local. Eso es
 * configuración de la cuenta, no del código, pero conviene saberlo
 * antes de prometerle plazos a nadie.
 */

import type {
  PaymentProvider, PaymentRequest, PaymentSession, PaymentNotification,
} from "./types";
import { PaymentError } from "./types";

const LIVE = "https://api-m.paypal.com";
const SANDBOX = "https://api-m.sandbox.paypal.com";

function baseUrl(): string {
  // Cualquier valor distinto de 'live' es sandbox. El default seguro es
  // el de prueba: un error de configuración no debería cobrar de verdad.
  return process.env.PAYPAL_ENV === "live" ? LIVE : SANDBOX;
}

function credentials(): { id: string; secret: string } | null {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

/** Token de acceso. PayPal los da por horas; se pide uno por operación. */
async function accessToken(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new PaymentError("PayPal no está configurado", 503);

  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new PaymentError("PayPal rechazó las credenciales", 502);
  }
  const data = await response.json();
  return data.access_token as string;
}

export const paypalProvider: PaymentProvider = {
  info: {
    id: "paypal",
    label: "Pagar con PayPal o tarjeta",
    hint: "Para pagos internacionales en dólares. Acepta tarjeta sin tener cuenta.",
    currencies: ["USD", "EUR", "GBP"],
  },

  isConfigured() {
    return credentials() !== null;
  },

  async createSession(request: PaymentRequest): Promise<PaymentSession> {
    const token = await accessToken();

    const response = await fetch(`${baseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Si el cliente toca "pagar" dos veces, PayPal devuelve la misma
        // orden en vez de crear dos cobros.
        "PayPal-Request-Id": request.invoiceId,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          // La referencia es el id de la factura: es lo que vuelve en el
          // webhook y lo único que hace falta para saber qué se pagó.
          reference_id: request.invoiceId,
          invoice_id: request.invoiceNumber,
          description: request.description.slice(0, 127),
          amount: {
            currency_code: request.currency,
            value: request.amount.toFixed(2),
          },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: "PAY_NOW",
              return_url: request.returnUrl,
              cancel_url: request.cancelUrl,
            },
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new PaymentError(data?.message ?? "PayPal no pudo crear el pago");
    }

    const approve = (data.links ?? []).find((l: any) => l.rel === "payer-action" || l.rel === "approve");
    if (!approve?.href) {
      throw new PaymentError("PayPal no devolvió el enlace de pago");
    }

    return { provider: "paypal", checkoutUrl: approve.href, externalId: data.id };
  },

  async parseWebhook(request: Request, rawBody: string): Promise<PaymentNotification> {
    const token = await accessToken();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      throw new PaymentError("Falta PAYPAL_WEBHOOK_ID: sin eso no se puede validar la firma", 503);
    }

    // Verificación contra PayPal. Sin esto, cualquiera que conozca la
    // URL puede marcar facturas como pagadas con un POST.
    const verification = await fetch(`${baseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: request.headers.get("paypal-auth-algo"),
        cert_url: request.headers.get("paypal-cert-url"),
        transmission_id: request.headers.get("paypal-transmission-id"),
        transmission_sig: request.headers.get("paypal-transmission-sig"),
        transmission_time: request.headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });

    const verdict = await verification.json();
    if (verdict?.verification_status !== "SUCCESS") {
      throw new PaymentError("Firma de webhook inválida", 401);
    }

    const event = JSON.parse(rawBody);
    const resource = event?.resource ?? {};

    // Solo la captura completada significa dinero acreditado. Un
    // 'APPROVED' es el cliente diciendo que sí, no el banco.
    const paid = event?.event_type === "PAYMENT.CAPTURE.COMPLETED";

    return {
      paid,
      invoiceId:
        resource?.supplementary_data?.related_ids?.order_id
          ? (resource?.custom_id ?? extractReference(resource))
          : extractReference(resource),
      externalId: resource?.id ?? null,
      rawStatus: `${event?.event_type ?? "?"}/${resource?.status ?? "?"}`,
    };
  },
};

/** El reference_id que se mandó al crear la orden. */
function extractReference(resource: any): string | null {
  return (
    resource?.custom_id ??
    resource?.reference_id ??
    resource?.purchase_units?.[0]?.reference_id ??
    null
  );
}
