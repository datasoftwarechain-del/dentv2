/**
 * Formateo de dinero por organización.
 *
 * El estudio de diseño vende afuera y cobra en dólares; el laboratorio
 * físico factura en pesos. El mismo número guardado en la base —
 * price_catalog.base_price es un NUMERIC sin moneda — se lee distinto
 * según quién lo mire.
 *
 * El riesgo concreto que esto evita: con formato argentino, 12.99 se
 * imprime como "$12,99". Un odontólogo en Inglaterra lee esa coma como
 * separador de miles y entiende otro precio. La moneda no es un detalle
 * de presentación cuando el cliente está en otro país.
 */

export type Currency = "USD" | "ARS";

/** Locale de cada moneda. El separador decimal es lo que cambia. */
const LOCALE: Record<Currency, string> = {
  USD: "en-US", // 12.99
  ARS: "es-AR", // 12,99
};

/**
 * Qué moneda usa una organización.
 *
 * Hoy se deriva del tipo porque hay una sola regla: el estudio de diseño
 * cobra en dólares. Si mañana hacen falta euros o libras, esto pasa a ser
 * una columna en organizations y solo cambia esta función.
 */
export function currencyForOrgType(orgType: string | null | undefined): Currency {
  // El estudio vende en dólares, y su cliente de diseño compra en dólares:
  // los dos lados de la misma factura tienen que leer el mismo número.
  return orgType === "design_studio" || orgType === "design_client" ? "USD" : "ARS";
}

/**
 * Importe con su símbolo.
 *
 * El dólar se marca "US$" y no "$" a propósito: en Uruguay y Argentina
 * "$" es el peso, y un precio internacional que no aclara la moneda se
 * presta a que el cliente entienda un número que no es.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: Currency = "ARS",
  options?: { decimals?: number },
): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;

  // Por defecto se muestran decimales solo si el importe los tiene: un
  // arancel de US$ 7 no gana nada con ser "US$ 7.00", pero US$ 12.99
  // no puede perder los centavos.
  const decimals =
    options?.decimals ?? (Number.isInteger(safe) ? 0 : 2);

  const formatted = safe.toLocaleString(LOCALE[currency], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return currency === "USD" ? `US$ ${formatted}` : `$${formatted}`;
}

/** Atajo para pantallas que ya saben el tipo de organización. */
export function formatMoneyForOrg(
  value: number | null | undefined,
  orgType: string | null | undefined,
  options?: { decimals?: number },
): string {
  return formatMoney(value, currencyForOrgType(orgType), options);
}
