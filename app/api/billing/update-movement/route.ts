import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsMovement } from "@/lib/auth-utils";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { movementId, amount, description, date, organizationId, clientId, isDentist } = body;

    if (!movementId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Verificar que el usuario tiene acceso a este movimiento
    const authorized = await verifyUserOwnsMovement(user.id, movementId);
    if (!authorized) {
      console.warn(`[SECURITY] User ${user.id} attempted to update movement ${movementId}`);
      return NextResponse.json(
        { error: "No autorizado para actualizar este movimiento" },
        { status: 403 }
      );
    }

    const parsedAmount = parseFloat(amount);

    // Preparar datos de actualización
    const updateData: any = {
      amount: parsedAmount,
      description: description || null,
    };

    // Solo actualizar created_at si se proporciona una fecha
    if (date) {
      updateData.created_at = new Date(date).toISOString();
    }

    console.log("Actualizando movimiento:", movementId, updateData);

    // Actualizar el movimiento
    const { data: updatedData, error: updateError } = await supabase
      .from("ledger_movements")
      .update(updateData)
      .eq("id", movementId)
      .select();

    if (updateError) {
      console.error("Error al actualizar:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Error al actualizar movimiento" },
        { status: 500 }
      );
    }

    console.log("Movimiento actualizado:", updatedData);

    // Recalcular balances para esta relación
    await recalculateBalances(supabase, organizationId, clientId, isDentist);

    // Revalidar páginas
    revalidatePath(`/dashboard/billing/accounts/${clientId}`);
    revalidatePath("/dashboard/billing");

    return NextResponse.json({
      success: true,
      message: "Movimiento actualizado correctamente",
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
