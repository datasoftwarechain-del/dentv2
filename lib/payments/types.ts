/**
 * [payments] Capa de pasarelas de pago.
 *
 * POR QUÉ UNA INTERFAZ Y NO PayPal CABLEADO
 *   Stripe no opera en Uruguay, Argentina, Chile, Colombia ni Perú —
 *   en la región solo cubre Brasil y México. Eso obliga a combinar
 *   proveedores: PayPal para el cliente de afuera que paga en dólares,
 *   Mercado Pago para el de la región que paga en pesos. Y el día que
 *   Stripe llegue, o que la empresa se constituya afuera, tiene que
 *   entrar sin tocar el módulo de diseño.
 *
 *   Todo lo que el negocio necesita de una pasarela son dos cosas:
 *   mandar al cliente a pagar, y enterarse de que pagó. Eso es esta
 *   interfaz. Lo demás es detalle de cada proveedor.
 *
 * DÓNDE TERMINA EL PAGO
 *   Todos los caminos convergen en marcar la factura como `paid`. De
 *   ahí en adelante ya está resuelto: el trigger
 *   invoices_release_design_order (migración 037) saca la orden de
 *   'awaiting_payment' y la mete en la cola del estudio. Un proveedor
 *   nuevo no necesita saber nada de órdenes de diseño.
 */

export type PaymentProviderId = "paypal" | "mercadopago";

export interface PaymentProviderInfo {
  id: PaymentProviderId;
  /** Nombre que ve el cliente en el botón. */
  label: string;
  /** Una línea explicando cuándo conviene. */
  hint: string;
  /** Monedas que este proveedor acepta en esta integración. */
  currencies: string[];
}

/** Lo que hay que cobrar. */
export interface PaymentRequest {
  /** Id de la factura. Viaja como referencia externa y vuelve en el webhook. */
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  /** Qué se está pagando, para que el cliente lo reconozca en el checkout. */
  description: string;
  /** A dónde vuelve el cliente al terminar. */
  returnUrl: string;
  cancelUrl: string;
  payerEmail?: string | null;
}

/** A dónde mandar al cliente. */
export interface PaymentSession {
  provider: PaymentProviderId;
  /** URL del checkout del proveedor. */
  checkoutUrl: string;
  /** Id de la operación del lado del proveedor, para rastrearla. */
  externalId: string;
}

/** Lo que un webhook logró averiguar. */
export interface PaymentNotification {
  /** true = el dinero está acreditado. Cualquier otra cosa no se toca. */
  paid: boolean;
  /** La factura que se estaba pagando. */
  invoiceId: string | null;
  externalId: string | null;
  /** Para la bitácora cuando algo no cierra. */
  rawStatus: string;
}

export interface PaymentProvider {
  info: PaymentProviderInfo;
  /** true si tiene las credenciales cargadas. Sin esto no se ofrece. */
  isConfigured(): boolean;
  createSession(request: PaymentRequest): Promise<PaymentSession>;
  /**
   * Valida la firma del webhook y extrae qué pasó.
   *
   * Devolver `paid: true` sin haber validado la firma sería dejar que
   * cualquiera marque facturas como pagadas mandando un POST. Cada
   * implementación valida contra el proveedor antes de afirmar nada.
   */
  parseWebhook(request: Request, rawBody: string): Promise<PaymentNotification>;
}

/** Error con un mensaje que se le puede mostrar al cliente. */
export class PaymentError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "PaymentError";
  }
}
