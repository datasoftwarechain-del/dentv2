/**
 * [payments] Registro de pasarelas.
 *
 * Un proveedor se ofrece solo si tiene sus credenciales cargadas. Así el
 * sistema arranca sin ninguna configurada — el módulo de diseño sigue
 * funcionando en modo factura manual — y se van encendiendo a medida
 * que se contratan, sin tocar código ni migrar nada.
 */

import type { PaymentProvider, PaymentProviderId, PaymentProviderInfo } from "./types";
import { paypalProvider } from "./paypal";
import { mercadopagoProvider } from "./mercadopago";

const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  paypal: paypalProvider,
  mercadopago: mercadopagoProvider,
};

export function getProvider(id: string): PaymentProvider | null {
  return PROVIDERS[id as PaymentProviderId] ?? null;
}

/** Proveedores listos para usar, filtrados por la moneda a cobrar. */
export function availableProviders(currency: string): PaymentProviderInfo[] {
  return Object.values(PROVIDERS)
    .filter((p) => p.isConfigured() && p.info.currencies.includes(currency))
    .map((p) => p.info);
}

/** ¿Hay alguna pasarela encendida? Si no, se cobra por fuera. */
export function hasAnyProvider(currency: string): boolean {
  return availableProviders(currency).length > 0;
}

export * from "./types";
