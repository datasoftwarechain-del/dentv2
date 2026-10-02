/**
 * CSRF por doble cookie: el token tiene que venir en la cookie Y en la
 * cabecera, y coincidir. La cookie la emite proxy.ts; la cabecera la pone
 * el cliente leyéndola con document.cookie.
 *
 * Sin tests hasta hoy, siendo el guardián de las 50 rutas que mutan datos.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateCSRF } from "@/lib/csrf";

const pedido = (opts: { method?: string; cookie?: string; header?: string } = {}) => {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", `csrf_token=${opts.cookie}`);
  if (opts.header) headers.set("x-csrf-token", opts.header);
  return new NextRequest("https://ejemplo.test/api/x", { method: opts.method ?? "POST", headers });
};

const TOKEN = "3f1c8a92-7b4e-4d2a-9c11-5e6f0a8b2d31";

describe("validateCSRF", () => {
  it("deja pasar los métodos seguros sin pedir token", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(validateCSRF(pedido({ method }))).toBeNull();
    }
  });

  it("acepta cuando cookie y cabecera coinciden", () => {
    expect(validateCSRF(pedido({ cookie: TOKEN, header: TOKEN }))).toBeNull();
  });

  it("rechaza con 403 si no coinciden", async () => {
    const r = validateCSRF(pedido({ cookie: TOKEN, header: "otro-token-distinto-aaaaaaaaaaaa" }));
    expect(r?.status).toBe(403);
  });

  it("FALLA CERRADO sin cookie", () => {
    expect(validateCSRF(pedido({ header: TOKEN }))?.status).toBe(403);
  });

  it("FALLA CERRADO sin cabecera", () => {
    expect(validateCSRF(pedido({ cookie: TOKEN }))?.status).toBe(403);
  });

  it("FALLA CERRADO sin ninguna de las dos", () => {
    expect(validateCSRF(pedido({}))?.status).toBe(403);
  });

  it("rechaza si solo coincide un prefijo (no compara por longitud parcial)", () => {
    expect(validateCSRF(pedido({ cookie: TOKEN, header: TOKEN.slice(0, 10) }))?.status).toBe(403);
  });

  it("rechaza si la cabecera es más larga que la cookie", () => {
    expect(validateCSRF(pedido({ cookie: TOKEN, header: TOKEN + "x" }))?.status).toBe(403);
  });

  it("protege DELETE y PUT, no solo POST", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      expect(validateCSRF(pedido({ method }))?.status).toBe(403);
      expect(validateCSRF(pedido({ method, cookie: TOKEN, header: TOKEN }))).toBeNull();
    }
  });
});
