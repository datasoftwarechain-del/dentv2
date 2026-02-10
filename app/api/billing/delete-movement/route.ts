import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsMovement } from "@/lib/auth-utils";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { movementId, organizationId, clientId, isDentist } = body;

    if (!movementId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Verificar que el usuario tiene acceso a este movimiento
    const authorized = await verifyUserOwnsMovement(user.id, movementId);
    if (!authorized) {
      console.warn(`[SECURITY] User ${user.id} attempted to delete movement ${movementId}`);
      return NextResponse.json(
        { error: "No autorizado para eliminar este movimiento" },
        { status: 403 }
      );
    }

    console.log("Eliminando movimiento:", movementId);

    // Eliminar el movimiento
    const { data: deletedData, error: deleteError } = await supabase
      .from("ledger_movements")
      .delete()
      .eq("id", movementId)
      .select();

    if (deleteError) {
      console.error("Error al eliminar:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Error al eliminar movimiento" },
        { status: 500 }
      );
    }

    console.log("Movimiento eliminado:", deletedData);

    // Recalcular balances para esta relación
    await recalculateBalances(supabase, organizationId, clientId, isDentist);

    // Revalidar páginas
    revalidatePath(`/dashboard/billing/accounts/${clientId}`);
    revalidatePath("/dashboard/billing");

    return NextResponse.json({
      success: true,
      message: "Movimiento eliminado correctamente",
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
