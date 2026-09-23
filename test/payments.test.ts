import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProvider, availableProviders, hasAnyProvider } from "@/lib/payments";

const ENV_KEYS = [
  "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET",
  "MERCADOPAGO_ACCESS_TOKEN",
];

describe("registro de pasarelas", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) { original[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("sin credenciales no se ofrece ninguna", () => {
    // El sistema tiene que arrancar sin pasarelas: el módulo sigue
    // funcionando en modo factura manual.
    expect(availableProviders("USD")).toEqual([]);
    expect(hasAnyProvider("USD")).toBe(false);
  });

  it("una pasarela aparece recién cuando tiene sus credenciales", () => {
    process.env.PAYPAL_CLIENT_ID = "x";
    process.env.PAYPAL_CLIENT_SECRET = "y";
    const ids = availableProviders("USD").map((p) => p.id);
    expect(ids).toEqual(["paypal"]);
  });

  it("PayPal con credenciales a medias NO se ofrece", () => {
    // Ofrecer un botón que va a fallar al tocarlo es peor que no tenerlo.
    process.env.PAYPAL_CLIENT_ID = "solo-el-id";
    expect(availableProviders("USD")).toEqual([]);
  });

  it("solo se ofrecen las que cubren la moneda que se cobra", () => {
    process.env.PAYPAL_CLIENT_ID = "x";
    process.env.PAYPAL_CLIENT_SECRET = "y";
    process.env.MERCADOPAGO_ACCESS_TOKEN = "z";

    // El diseño se cobra en USD: las dos sirven.
    expect(availableProviders("USD").map((p) => p.id).sort())
      .toEqual(["mercadopago", "paypal"]);

    // En pesos uruguayos PayPal no entra.
    expect(availableProviders("UYU").map((p) => p.id)).toEqual(["mercadopago"]);

    // Una moneda que nadie cubre no devuelve nada en vez de romper.
    expect(availableProviders("JPY")).toEqual([]);
  });

  it("un proveedor desconocido devuelve null, no explota", () => {
    expect(getProvider("stripe")).toBeNull();
    expect(getProvider("")).toBeNull();
  });

  it("cada pasarela declara etiqueta y ayuda para el botón", () => {
    for (const id of ["paypal", "mercadopago"]) {
      const p = getProvider(id)!;
      expect(p.info.label.length).toBeGreaterThan(3);
      expect(p.info.hint.length).toBeGreaterThan(10);
      expect(p.info.currencies.length).toBeGreaterThan(0);
    }
  });
});
