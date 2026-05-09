import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { recalculateBalances } from "@/lib/balance-utils";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import {
  isCollaboratorRole,
  hasPermission,
  permissionDeniedMessage,
} from "@/lib/permissions";
import { validateCSRF } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// [BLOQUE 8] POST /api/billing/invoices/[id]/sync-from-items
//
// Recomputes the invoice subtotal/tax_amount/total from the CURRENT
// state of lab_order_items + extras and updates the persisted columns.
// Sets totals_strict=true so the invoice becomes a "live" record going
// forward (future edits via update-invoice work normally).
//
// Use case: items were added/edited after the invoice was emitted, so
// the persisted total drifted from reality. Instead of forcing the user
// to anular + reissue, this endpoint just resyncs the persisted total.
//
// Authorization:
//   - Lab-only (org.type === 'lab').
//   - Collaborator must have manage_billing.
//   - Ownership check: invoice.lab_org_id must equal org.id.
//   - Voided invoices: 409 (sync doesn't apply to voided ones).
//   - Manual invoices without order_id: 404 (nothing to recompute from).
//
// Manual override guard:
//   - If invoice.manually_overridden=true and the request does NOT carry
//     `?force=true`, returns 409 with `requires_force: true` so the UI
//     can show a confirmation dialog. When force=true is provided, the
//     sync proceeds AND clears manually_overridden back to false (the
//     manual ajuste was intentionally overwritten).
//
// Side effects:
//   - UPDATE invoices SET subtotal, tax_amount, total, totals_strict=true,
//     manually_overridden=false (when forcing over a previous override).
//   - recalculateBalances over the lab↔dentist relation so the running
//     balance in ledger_movements reflects the new total.
//   - revalidatePath of all surfaces.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio sincroniza facturas." },
        { status: 403 },
      );
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_billing")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_billing"), missing_flag: "manage_billing" },
        { status: 403 },
      );
    }

    const supabase = await createClient();

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    const { data: invoice, error: readErr } = await supabase
      .from("invoices")
      .select(
        "id, lab_org_id, dentist_org_id, order_id, invoice_voided_at, tax_rate, total, manually_overridden, totals_strict",
      )
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (invoice.lab_org_id !== org.id) {
      logger.security(`User attempted to sync invoice ${id} from another org`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (invoice.invoice_voided_at) {
      return NextResponse.json(
        { error: "Esta factura está anulada — sincronizar no aplica." },
        { status: 409 },
      );
    }
    // [Auditoría 8.1] Las facturas históricas (totals_strict=false) son
    // intocables por diseño: sus montos persistidos son fuente de verdad.
    // Sincronizarlas las convertiría silenciosamente en strict y se perdería
    // la naturaleza histórica. Bloquear acá; la UI ya tenía la guarda en
    // unified-account-statement, esto cierra el flanco vía POST directo.
    if (invoice.totals_strict === false) {
      return NextResponse.json(
        {
          error: "Factura histórica. Anulá y emití una nueva si necesitás cambiar el monto.",
        },
        { status: 400 },
      );
    }
    if (!invoice.order_id) {
      return NextResponse.json(
        { error: "Factura manual sin ítems vinculados — no hay items para recomputar." },
        { status: 404 },
      );
    }

    // Manual override guard: si la factura tiene un ajuste manual y no
    // viene ?force=true, la UI tiene que confirmar antes de sobrescribir.
    if (invoice.manually_overridden === true && !force) {
      return NextResponse.json(
        {
          error:
            "Esta factura tiene un ajuste manual. Sincronizar va a sobrescribirlo.",
          requires_force: true,
          persisted_total: Number(invoice.total) || 0,
        },
        { status: 409 },
      );
    }

    // Fetch current items state.
    const { data: items, error: itemsErr } = await supabase
      .from("lab_order_items")
      .select("unit_price, quantity, selected_extras, catalog_item:price_catalog(base_price)")
      .eq("order_id", invoice.order_id);
    if (itemsErr) throw itemsErr;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "La orden no tiene ítems para recomputar." },
        { status: 404 },
      );
    }

    // Normalize the catalog_item join (Supabase returns object or array).
    const itemsForCompute = items.map((it: any) => ({
      unit_price: it.unit_price,
      quantity: it.quantity,
      selected_extras: it.selected_extras,
      catalog_item: Array.isArray(it.catalog_item) ? it.catalog_item[0] : it.catalog_item,
    }));

    const taxRate = Number(invoice.tax_rate) || 0;
    const { subtotal, taxAmount, total } = computeInvoiceTotals(itemsForCompute, taxRate);

    const { error: updErr } = await supabase
      .from("invoices")
      .update({
        subtotal,
        tax_amount: taxAmount,
        total,
        totals_strict: true,
        // Si veníamos de un override, sincronizar lo limpia: la intención
        // explícita del usuario al confirmar el ?force=true es volver a
        // dejar la factura "viva" y recalculable desde items.
        manually_overridden: false,
      })
      .eq("id", id);
    if (updErr) throw updErr;

    // Re-run balances so ledger movement balances reflect the new total.
    await recalculateBalances(supabase, org.id, invoice.dentist_org_id, false);

    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/billing/accounts/[clientId]", "page");
    revalidatePath("/dashboard/clients/[id]", "page");
    if (invoice.order_id) {
      revalidatePath(`/dashboard/orders/${invoice.order_id}`);
    }

    return NextResponse.json({
      success: true,
      subtotal,
      tax_amount: taxAmount,
      total,
    });
  } catch (err: any) {
    logger.error("Error syncing invoice from items:", err);
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 },
    );
  }
}
