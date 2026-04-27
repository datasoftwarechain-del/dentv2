import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsInvoice } from "@/lib/auth-utils";
import { recalculateBalances } from "@/lib/balance-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";

// Monetary fields son opcionales: facturas históricas (totals_strict=false)
// rechazan cualquier intento de modificarlos. Facturas nuevas (true) los
// requieren para una edición de monto coherente.
const UpdateInvoiceSchema = z.object({
  invoiceId: z.string().uuid("invoiceId debe ser un UUID válido"),
  total: z.coerce.number().positive("El total debe ser positivo").optional(),
  subtotal: z.coerce.number().optional(),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
  tax_amount: z.coerce.number().min(0).optional(),
  patient_name: z.string().max(200).nullable().optional(),
  work_type: z.string().max(200).nullable().optional(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  isDentist: z.boolean(),
});

const READ_ONLY_HISTORICAL_MSG =
  "Factura histórica (read-only en montos). Para cambiar el monto, anulala y emití una nueva.";

export async function PUT(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateBody(request, UpdateInvoiceSchema);
    if (validation.error) return validation.error;
    const {
      invoiceId, total, subtotal, tax_rate, tax_amount,
      patient_name, work_type,
      organizationId, clientId, isDentist,
    } = validation.data;

    // SECURITY: Verificar que el usuario tiene acceso a esta factura
    const authorized = await verifyUserOwnsInvoice(user.id, invoiceId);
    if (!authorized) {
      logger.security(`User ${user.id} attempted to update invoice ${invoiceId}`);
      return NextResponse.json(
        { error: "No autorizado para actualizar esta factura" },
        { status: 403 }
      );
    }

    // Leer estado actual para decidir qué se permite editar
    const { data: existing, error: readError } = await supabase
      .from("invoices")
      .select("totals_strict")
      .eq("id", invoiceId)
      .single();

    if (readError || !existing) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const isStrict = existing.totals_strict === true;
    const hasMonetary =
      total !== undefined ||
      subtotal !== undefined ||
      tax_rate !== undefined ||
      tax_amount !== undefined;

    // Factura histórica: bloquear cualquier cambio de montos
    if (!isStrict && hasMonetary) {
      logger.security(
        `User ${user.id} attempted monetary edit on historical invoice ${invoiceId}`
      );
      return NextResponse.json(
        { error: READ_ONLY_HISTORICAL_MSG },
        { status: 400 }
      );
    }

    // Factura nueva: si se manda alguno de los montos, total es obligatorio
    if (isStrict && hasMonetary && total === undefined) {
      return NextResponse.json(
        { error: "Falta el campo total para editar montos." },
        { status: 400 }
      );
    }

    // Construir updateData solo con los campos enviados
    const updateData: Record<string, unknown> = {};

    if (isStrict && hasMonetary && total !== undefined) {
      const parsedTotal    = Number(total);
      const parsedSubtotal = subtotal != null ? Number(subtotal) : parsedTotal;
      const parsedTaxRate  = tax_rate != null ? Number(tax_rate) : 0;
      const parsedTaxAmt   = tax_amount != null ? Number(tax_amount) : 0;
      updateData.total      = parsedTotal;
      updateData.subtotal   = parsedSubtotal;
      updateData.tax_rate   = parsedTaxRate;
      updateData.tax_amount = parsedTaxAmt;
    }

    if (patient_name !== undefined) updateData.patient_name = patient_name || null;
    if (work_type !== undefined)    updateData.work_type    = work_type || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No hay cambios para aplicar." },
        { status: 400 }
      );
    }

    logger.log("Actualizando factura:", invoiceId, updateData);

    const { data: updatedData, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select();

    if (updateError) {
      logger.error("Error al actualizar:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Error al actualizar factura" },
        { status: 500 }
      );
    }

    logger.log("Factura actualizada:", updatedData);

    // Recalcular balances solo si cambió el monto
    if (updateData.total !== undefined) {
      await recalculateBalances(supabase, organizationId, clientId, isDentist);
    }

    revalidatePath(`/dashboard/billing/accounts/${clientId}`);
    revalidatePath("/dashboard/billing");

    return NextResponse.json({
      success: true,
      message: "Factura actualizada correctamente",
    });
  } catch (error: any) {
    logger.error("Error completo:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
