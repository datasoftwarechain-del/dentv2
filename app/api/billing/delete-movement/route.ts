import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsMovement } from "@/lib/auth-utils";
import { recalculateBalances } from "@/lib/balance-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";

const DeleteMovementSchema = z.object({
  movementId: z.string().uuid("movementId debe ser un UUID válido"),
  organizationId: z.string().uuid("organizationId debe ser un UUID válido"),
  clientId: z.string().uuid("clientId debe ser un UUID válido"),
  isDentist: z.boolean(),
});

export async function DELETE(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateBody(request, DeleteMovementSchema);
    if (validation.error) return validation.error;
    const { movementId, organizationId, clientId, isDentist } = validation.data;

    // SECURITY: Verificar que el usuario tiene acceso a este movimiento
    const authorized = await verifyUserOwnsMovement(user.id, movementId);
    if (!authorized) {
      logger.security(`User ${user.id} attempted to delete movement ${movementId}`);
      return NextResponse.json(
        { error: "No autorizado para eliminar este movimiento" },
        { status: 403 }
      );
    }

    logger.log("Eliminando movimiento:", movementId);

    // Eliminar el movimiento
    const { data: deletedData, error: deleteError } = await supabase
      .from("ledger_movements")
      .delete()
      .eq("id", movementId)
      .select();

    if (deleteError) {
      logger.error("Error al eliminar:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Error al eliminar movimiento" },
        { status: 500 }
      );
    }

    logger.log("Movimiento eliminado:", deletedData);

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
    logger.error("Error completo:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
