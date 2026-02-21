import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsInvoice } from "@/lib/auth-utils";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, total, subtotal, tax_rate, tax_amount, patient_name, work_type, organizationId, clientId, isDentist } = body;

    if (!invoiceId || !total) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Verificar que el usuario tiene acceso a esta factura
    const authorized = await verifyUserOwnsInvoice(user.id, invoiceId);
    if (!authorized) {
      console.warn(`[SECURITY] User ${user.id} attempted to update invoice ${invoiceId}`);
      return NextResponse.json(
        { error: "No autorizado para actualizar esta factura" },
        { status: 403 }
      );
    }

    const parsedTotal    = parseFloat(total);
    const parsedSubtotal = subtotal  != null ? parseFloat(subtotal)   : parsedTotal;
    const parsedTaxRate  = tax_rate  != null ? parseFloat(tax_rate)   : 0;
    const parsedTaxAmt   = tax_amount != null ? parseFloat(tax_amount) : 0;

    // Preparar datos de actualización
    const updateData: any = {
      total:      parsedTotal,
      subtotal:   parsedSubtotal,
      tax_rate:   parsedTaxRate,
      tax_amount: parsedTaxAmt,
      patient_name: patient_name || null,
      work_type: work_type || null,
    };

    console.log("Actualizando factura:", invoiceId, updateData);

    // Actualizar la factura
    const { data: updatedData, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select();

    if (updateError) {
      console.error("Error al actualizar:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Error al actualizar factura" },
        { status: 500 }
      );
    }

    console.log("Factura actualizada:", updatedData);

    // Recalcular balances para esta relación
    await recalculateBalances(supabase, organizationId, clientId, isDentist);

    // Revalidar páginas
    revalidatePath(`/dashboard/billing/accounts/${clientId}`);
    revalidatePath("/dashboard/billing");

    return NextResponse.json({
      success: true,
      message: "Factura actualizada correctamente",
    });
  } catch (error: any) {
    console.error("Error completo:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Función para recalcular balances
async function recalculateBalances(
  supabase: any,
  organizationId: string,
  clientId: string,
  isDentist: boolean
) {
  console.log("Recalculando balances para:", { organizationId, clientId, isDentist });

  // Obtener todas las facturas para calcular el balance inicial
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total")
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", organizationId)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", clientId);

  const totalInvoiced = invoices?.reduce((sum: number, inv: any) => sum + Number(inv.total), 0) || 0;
  console.log("Total facturado:", totalInvoiced);

  let runningBalance = totalInvoiced;

  // Obtener todos los movimientos en orden cronológico
  const { data: movements } = await supabase
    .from("ledger_movements")
    .select("*")
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", organizationId)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", clientId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  console.log(`Recalculando ${movements?.length || 0} movimientos`);

  // Recalcular balance de cada movimiento
  if (movements) {
    for (const mov of movements) {
      // Payments reducen el balance, charges lo aumentan
      if (mov.type === "payment") {
        runningBalance -= Number(mov.amount);
      } else if (mov.type === "charge") {
        runningBalance += Number(mov.amount);
      }

      console.log(`Movimiento ${mov.id}: tipo=${mov.type}, monto=${mov.amount}, balance=${runningBalance}`);

      // Actualizar el balance de este movimiento
      const { error } = await supabase
        .from("ledger_movements")
        .update({ balance: runningBalance })
        .eq("id", mov.id);

      if (error) {
        console.error(`Error actualizando balance del movimiento ${mov.id}:`, error);
      }
    }
  }

  console.log("Recalculación completada. Balance final:", runningBalance);
}
