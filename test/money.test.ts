import { describe, it, expect } from "vitest";
import { formatMoney, formatMoneyForOrg, currencyForOrgType } from "@/lib/money";

describe("moneda por organización", () => {
  it("el estudio de diseño cobra en dólares", () => {
    expect(currencyForOrgType("design_studio")).toBe("USD");
  });

  it("todo lo demás sigue en pesos", () => {
    for (const t of ["lab", "dentist", "dentist_preview", null, undefined, "otro"]) {
      expect(currencyForOrgType(t)).toBe("ARS");
    }
  });
});

describe("formato", () => {
  it("el dólar se marca US$, no $ a secas", () => {
    // En la región "$" es el peso: un precio internacional sin aclarar
    // la moneda hace que el cliente entienda otro número.
    expect(formatMoney(99, "USD")).toBe("US$ 99");
    expect(formatMoney(99, "ARS")).toBe("$99");
  });

  it("usa punto decimal en USD y coma en ARS", () => {
    // Es el bug que esto evita: 12.99 en formato argentino sale "12,99",
    // y un lector inglés interpreta la coma como separador de miles.
    expect(formatMoney(12.99, "USD")).toBe("US$ 12.99");
    expect(formatMoney(12.99, "ARS")).toBe("$12,99");
  });

  it("no agrega decimales a un importe entero", () => {
    expect(formatMoney(7, "USD")).toBe("US$ 7");
    expect(formatMoney(6, "USD")).toBe("US$ 6");
  });

  it("nunca pierde los centavos de un importe que los tiene", () => {
    expect(formatMoney(12.5, "USD")).toBe("US$ 12.50");
    expect(formatMoney(0.99, "USD")).toBe("US$ 0.99");
  });

  it("se pueden forzar los decimales cuando la columna debe alinear", () => {
    expect(formatMoney(7, "USD", { decimals: 2 })).toBe("US$ 7.00");
  });

  it("separa miles según la moneda", () => {
    expect(formatMoney(1234, "USD")).toBe("US$ 1,234");
    expect(formatMoney(1234, "ARS")).toBe("$1.234");
  });

  it("null, undefined y NaN dan cero en vez de romper la pantalla", () => {
    expect(formatMoney(null, "USD")).toBe("US$ 0");
    expect(formatMoney(undefined, "USD")).toBe("US$ 0");
    expect(formatMoney(NaN, "USD")).toBe("US$ 0");
  });

  it("el atajo por organización encadena bien", () => {
    expect(formatMoneyForOrg(12.99, "design_studio")).toBe("US$ 12.99");
    expect(formatMoneyForOrg(12.99, "lab")).toBe("$12,99");
  });
});
