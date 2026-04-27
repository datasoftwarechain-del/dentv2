import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { recalculateBalances } from "@/lib/balance-utils";
import { logger } from "@/lib/logger";
import {
  isCollaboratorRole,
  hasPermission,
  permissionDeniedMessage,
} from "@/lib/permissions";
import { validateCSRF } from "@/lib/csrf";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// [BLOQUE 3] DELETE /api/billing/invoices/[id]
// Soft-deletes an invoice (sets invoice_voided_at = NOW()). Blocked when
// payments exist for this invoice — caller must refund/un-link first.
// Lab-only: a dentist receives invoices and cannot anull them.
//
// Defense in depth:
//   - CSRF (validateCSRF).
//   - getUserOrg → org type must be 'lab'.
//   - Collaborator must have manage_billing.
//   - Ownership: invoice.lab_org_id must match org.id.
//   - Payment guard: ledger_movements WHERE invoice_id=X AND type='payment'
//     blocks the soft-delete with 409 Conflict.
//
// Side effects after success:
//   - Optional: status='cancelled' (helps queries).
//   - Delete ledger_movements with invoice_id = X and type='charge' (the
//     base "alta" movement, if any). Payments are blocked above so won't
//     be present here. Other movement types (manual adjustments) are NOT
//     touched — they may have meaning beyond this single invoice.
//   - recalculateBalances rebuilds the ledger running balance excluding
//     the voided invoice (helper now filters invoice_voided_at IS NULL).
//   - revalidatePath of billing pages.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();

    // Lab-only flow.
    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio que emitió la factura puede anularla." },
        { status: 403 },
      );
    }

    // Manage billing permission for collaborators.
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_billing")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_billing"), missing_flag: "manage_billing" },
        { status: 403 },
      );
    }

    const supabase = await createClient();

    // Read invoice + ownership.
    const { data: invoice, error: readErr } = await supabase
      .from("invoices")
      .select("id, lab_org_id, dentist_org_id, invoice_number, total, invoice_voided_at, order_id")
      .eq("id", id)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (invoice.lab_org_id !== org.id) {
      logger.security(`User attempted to void invoice ${id} from another org`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (invoice.invoice_voided_at) {
      return NextResponse.json(
        { error: "Esta factura ya está anulada." },
        { status: 409 },
      );
    }

    // Payment guard.
    const { data: payments, error: payErr } = await supabase
      .from("ledger_movements")
      .select("id, amount")
      .eq("invoice_id", id)
      .eq("type", "payment");

    if (payErr) throw payErr;
    if (payments && payments.length > 0) {
      const total = payments.reduce((s, p: any) => s + Number(p.amount), 0);
      return NextResponse.json(
        {
          error: `No se puede anular: la factura tiene ${payments.length} pago(s) registrados por un total de $${total.toFixed(2)}. Reversá los pagos primero.`,
          payments_count: payments.length,
          payments_total: total,
        },
        { status: 409 },
      );
    }

    // Soft delete: set invoice_voided_at + status='cancelled'.
    const now = new Date().toISOString();
    const { error: voidErr } = await supabase
      .from("invoices")
      .update({ invoice_voided_at: now, status: "cancelled" })
      .eq("id", id);

    if (voidErr) throw voidErr;

    // Clean up the originating "charge" movement, if any.
    await supabase
      .from("ledger_movements")
      .delete()
      .eq("invoice_id", id)
      .eq("type", "charge");

    // Recalc balances for this lab↔dentist relation.
    await recalculateBalances(supabase, org.id, invoice.dentist_org_id, false);

    // Revalidate every page that lists or aggregates invoices.
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/billing/accounts/[clientId]", "page");
    revalidatePath("/dashboard/clients/[id]", "page");
    if (invoice.order_id) {
      revalidatePath(`/dashboard/orders/${invoice.order_id}`);
    }

    return NextResponse.json({
      success: true,
      message: `Factura ${invoice.invoice_number} anulada correctamente.`,
    });
  } catch (err: any) {
    logger.error("Error voiding invoice:", err);
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 },
    );
  }
}
