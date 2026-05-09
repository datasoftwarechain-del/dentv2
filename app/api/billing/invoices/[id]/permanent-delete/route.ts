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

// DELETE /api/billing/invoices/[id]/permanent-delete
//
// Hard-delete (irreversible) de una factura. NO confundir con DELETE
// /api/billing/invoices/[id] que es soft-delete (anular vía
// invoice_voided_at). Coexisten:
//   - Anular  → soft-delete reversible, contable.
//   - Eliminar permanentemente → borra la fila de DB y los movimientos
//     ledger asociados de tipo 'charge'.
//
// Reglas:
//   - Lab-only (org.type === 'lab').
//   - Colaborador requiere manage_billing.
//   - Ownership: invoice.lab_org_id === org.id.
//   - Si tiene pagos asociados (ledger_movements type='payment'), 409 —
//     la UI tiene que anular los pagos primero.
//
// Side effects:
//   - DELETE ledger_movements WHERE invoice_id = X AND type = 'charge' (si los hubiera).
//   - DELETE invoices WHERE id = X.
//   - recalculateBalances (re-arma el running balance excluyendo la factura).
//   - revalidatePath de las páginas de billing.
export async function DELETE(
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
        { error: "Solo el laboratorio que emitió la factura puede eliminarla." },
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

    const { data: invoice, error: readErr } = await supabase
      .from("invoices")
      .select("id, lab_org_id, dentist_org_id, invoice_number, order_id")
      .eq("id", id)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (invoice.lab_org_id !== org.id) {
      logger.security(`User attempted to permanent-delete invoice ${id} from another org`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Payment guard. Si hay pagos asociados, no permitir hard-delete:
    // borrarías evidencia de pagos cobrados. Caller debe anular en su lugar.
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
          error: `No se puede eliminar: la factura tiene ${payments.length} pago(s) registrados por un total de $${total.toFixed(2)}. Anulala en su lugar.`,
          payments_count: payments.length,
          payments_total: total,
        },
        { status: 409 },
      );
    }

    // Limpiar el movimiento 'charge' originario (si existiese).
    await supabase
      .from("ledger_movements")
      .delete()
      .eq("invoice_id", id)
      .eq("type", "charge");

    // Si la orden todavía referencia esta factura, soltar el FK antes de borrar.
    if (invoice.order_id) {
      await supabase
        .from("lab_orders")
        .update({ invoice_id: null })
        .eq("id", invoice.order_id)
        .eq("invoice_id", id);
    }

    // Hard-delete la factura.
    const { error: delErr } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id);

    if (delErr) throw delErr;

    await recalculateBalances(supabase, org.id, invoice.dentist_org_id, false);

    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/billing/accounts/[clientId]", "page");
    revalidatePath("/dashboard/clients/[id]", "page");
    if (invoice.order_id) {
      revalidatePath(`/dashboard/orders/${invoice.order_id}`);
    }

    return NextResponse.json({
      success: true,
      message: `Factura ${invoice.invoice_number} eliminada permanentemente.`,
    });
  } catch (err: any) {
    logger.error("Error permanent-deleting invoice:", err);
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 },
    );
  }
}
