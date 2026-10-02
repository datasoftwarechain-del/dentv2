/**
 * Saldo de cuenta: lo que el cliente DEBE.
 *
 * Este módulo no tenía ni un test, y ya estuvo mal una vez en producción:
 * la lista de clientes sumaba facturas con `status != 'paid'`, pero
 * registrar un pago NO marca facturas — escribe en `ledger_movements`.
 * Medido contra prod en su momento: 33 de 38 clientes mostraban un saldo
 * distinto al de su propio estado de cuenta.
 *
 * Los montos llegan de Supabase como STRING (los `numeric` de Postgres se
 * serializan así), por eso varios casos usan strings a propósito.
 */

import { describe, it, expect } from "vitest";
import { computeAccountBalance } from "@/lib/balance-utils";

const inv = (total: unknown, voided?: unknown) => ({ total, invoice_voided_at: voided ?? null });
const mov = (type: string, amount: unknown) => ({ type, amount });

describe("computeAccountBalance", () => {
  it("sin facturas ni movimientos, todo en cero", () => {
    const r = computeAccountBalance([], []);
    expect(r).toEqual({
      totalInvoiced: 0, totalPaid: 0, totalCharges: 0, otherCredits: 0, balance: 0,
    });
  });

  it("solo facturas: el saldo es lo facturado", () => {
    const r = computeAccountBalance([inv(1000), inv(500)], []);
    expect(r.totalInvoiced).toBe(1500);
    expect(r.balance).toBe(1500);
  });

  it("un pago baja el saldo", () => {
    const r = computeAccountBalance([inv(1000)], [mov("payment", 400)]);
    expect(r.totalPaid).toBe(400);
    expect(r.balance).toBe(600);
  });

  it("un cargo sube el saldo", () => {
    const r = computeAccountBalance([inv(1000)], [mov("charge", 250)]);
    expect(r.totalCharges).toBe(250);
    expect(r.balance).toBe(1250);
  });

  it("cualquier otro tipo de movimiento cuenta como crédito y baja el saldo", () => {
    const r = computeAccountBalance([inv(1000)], [mov("credit_note", 300)]);
    expect(r.otherCredits).toBe(300);
    expect(r.balance).toBe(700);
  });

  it("pagar de más deja saldo A FAVOR del cliente (negativo)", () => {
    const r = computeAccountBalance([inv(1000)], [mov("payment", 1880)]);
    expect(r.balance).toBe(-880);
  });

  it("los montos que llegan como string se suman, no se concatenan", () => {
    // Si Number() no estuviera, "1000" + "500" daría "1000500".
    const r = computeAccountBalance([inv("1000.50"), inv("500.25")], [mov("payment", "300.75")]);
    expect(r.totalInvoiced).toBeCloseTo(1500.75, 2);
    expect(r.balance).toBeCloseTo(1200, 2);
  });

  it("total null o undefined cuenta como cero, no como NaN", () => {
    const r = computeAccountBalance([inv(null), inv(undefined), inv(100)], []);
    expect(r.totalInvoiced).toBe(100);
    expect(Number.isNaN(r.balance)).toBe(false);
  });

  it("una factura ANULADA no suma al saldo", () => {
    const r = computeAccountBalance(
      [inv(1000), inv(9999, "2026-09-30T12:00:00Z")],
      [],
    );
    expect(r.totalInvoiced).toBe(1000);
    expect(r.balance).toBe(1000);
  });

  it("el caso completo: facturado + cargos − pagos − créditos", () => {
    const r = computeAccountBalance(
      [inv(2000), inv(1000), inv(500, "2026-09-30T00:00:00Z")],
      [mov("payment", 800), mov("charge", 150), mov("credit_note", 50), mov("payment", 200)],
    );
    expect(r.totalInvoiced).toBe(3000);
    expect(r.totalPaid).toBe(1000);
    expect(r.totalCharges).toBe(150);
    expect(r.otherCredits).toBe(50);
    expect(r.balance).toBe(3000 + 150 - 1000 - 50);
  });
});
