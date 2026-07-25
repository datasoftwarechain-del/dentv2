import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canManagePricing,
  canViewPrices,
  normalizePermissions,
  isCollaboratorRole,
  sanitizeInvoiceForCollaborator,
  EMPTY_PERMISSIONS,
  type CollaboratorPermissions,
} from "@/lib/permissions";

// Réplica exacta de los gates que protegen la feature de Rentabilidad,
// para que cualquier cambio futuro que los rompa haga fallar un test.
//
// - Ver pestaña / márgenes  (page.tsx + /api/costs/summary):
//     admin  OR  (view_financial_dashboard AND view_billing_amounts)
// - Editar costos           (/api/costs/catalog PUT):
//     admin  OR  manage_pricing
function canSeeProfitability(role: string, perms: CollaboratorPermissions | null): boolean {
  if (!isCollaboratorRole(role)) return true; // admin/owner
  return hasPermission(perms, "view_financial_dashboard") && hasPermission(perms, "view_billing_amounts");
}
function canEditCosts(role: string, perms: CollaboratorPermissions | null): boolean {
  if (!isCollaboratorRole(role)) return true;
  return hasPermission(perms, "manage_pricing");
}

const collabWith = (over: Partial<CollaboratorPermissions>): CollaboratorPermissions =>
  ({ ...EMPTY_PERMISSIONS, ...over });

describe("hasPermission — base", () => {
  it("admin (null) siempre true", () => {
    expect(hasPermission(null, "manage_pricing")).toBe(true);
    expect(hasPermission(undefined, "view_billing_amounts")).toBe(true);
  });
  it("colaborador respeta el flag", () => {
    expect(hasPermission(collabWith({ manage_pricing: true }), "manage_pricing")).toBe(true);
    expect(hasPermission(collabWith({ manage_pricing: false }), "manage_pricing")).toBe(false);
  });
});

describe("Matriz de roles — Rentabilidad", () => {
  it("admin ve y edita", () => {
    expect(canSeeProfitability("admin", null)).toBe(true);
    expect(canEditCosts("admin", null)).toBe(true);
  });

  it("colaborador con view_financial_dashboard + view_billing_amounts: ve, NO edita", () => {
    const p = collabWith({ view_financial_dashboard: true, view_billing_amounts: true });
    expect(canSeeProfitability("collaborator", p)).toBe(true);
    expect(canEditCosts("collaborator", p)).toBe(false); // le falta manage_pricing
  });

  it("colaborador con manage_pricing (+ ver): ve y edita", () => {
    const p = collabWith({ view_financial_dashboard: true, view_billing_amounts: true, manage_pricing: true });
    expect(canSeeProfitability("collaborator", p)).toBe(true);
    expect(canEditCosts("collaborator", p)).toBe(true);
  });

  it("colaborador con financial pero SIN billing_amounts: NO ve (costo es dinero)", () => {
    const p = collabWith({ view_financial_dashboard: true, view_billing_amounts: false });
    expect(canSeeProfitability("collaborator", p)).toBe(false);
  });

  it("colaborador sin permisos de dinero: no ve ni edita", () => {
    const p = collabWith({});
    expect(canSeeProfitability("collaborator", p)).toBe(false);
    expect(canEditCosts("collaborator", p)).toBe(false);
  });

  it("colaborador con view_prices pero sin financial: NO ve la pestaña", () => {
    // view_prices habilita ver precios de venta, NO márgenes/costos.
    const p = collabWith({ view_prices: true, view_billing_amounts: true });
    expect(canSeeProfitability("collaborator", p)).toBe(false);
  });
});

describe("normalizePermissions", () => {
  it("objeto vacío → todo false", () => {
    const n = normalizePermissions({});
    expect(Object.values(n).every((v) => v === false)).toBe(true);
  });
  it("merge parcial: flags ausentes quedan en false", () => {
    const n = normalizePermissions({ manage_pricing: true });
    expect(n.manage_pricing).toBe(true);
    expect(n.view_billing_amounts).toBe(false);
  });
  it("null/undefined → EMPTY", () => {
    expect(normalizePermissions(null).manage_pricing).toBe(false);
    expect(normalizePermissions(undefined).view_prices).toBe(false);
  });
});

describe("canViewPrices / canManagePricing", () => {
  it("admin true", () => {
    expect(canViewPrices(null)).toBe(true);
    expect(canManagePricing(null)).toBe(true);
  });
  it("colaborador según flags", () => {
    expect(canViewPrices(collabWith({ view_prices: true }))).toBe(true);
    expect(canViewPrices(collabWith({}))).toBe(false);
    expect(canManagePricing(collabWith({ manage_pricing: true }))).toBe(true);
  });
});

describe("sanitizeInvoiceForCollaborator — aislamiento de montos", () => {
  const invoice = {
    id: "inv1",
    invoice_number: "0001",
    total: 1000,
    subtotal: 900,
    order_items: [{ unit_price: 300, quantity: 1, catalog_item: { name: "Corona", base_price: 300 } }],
  };

  it("admin: no toca nada", () => {
    const out = sanitizeInvoiceForCollaborator(invoice, null);
    expect(out.total).toBe(1000);
    expect(out.order_items?.[0].unit_price).toBe(300);
  });

  it("colaborador sin montos: borra total, subtotal, unit_price y base_price", () => {
    const out = sanitizeInvoiceForCollaborator(invoice, collabWith({}));
    expect(out.total).toBeUndefined();
    expect(out.subtotal).toBeUndefined();
    expect(out.order_items?.[0].unit_price).toBeUndefined();
    expect((out.order_items?.[0].catalog_item as any).base_price).toBeUndefined();
  });

  it("no muta el objeto original", () => {
    const clone = JSON.parse(JSON.stringify(invoice));
    sanitizeInvoiceForCollaborator(invoice, collabWith({}));
    expect(invoice).toEqual(clone);
  });
});
