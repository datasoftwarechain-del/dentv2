import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsMovement } from "@/lib/auth-utils";
import { recalculateBalances } from "@/lib/balance-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";

const UpdateMovementSchema = z.object({
  movementId: z.string().uuid("movementId debe ser un UUID válido"),
  amount: z.coerce.number().positive("El monto debe ser un número positivo"),
  description: z.string().max(500).nullable().optional(),
  date: z.string().optional(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  isDentist: z.boolean(),
});

export async function PUT(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateBody(request, UpdateMovementSchema);
    if (validation.error) return validation.error;
    const { movementId, amount, description, date, organizationId, clientId, isDentist } = validation.data;

    // SECURITY: Verificar que el usuario tiene acceso a este movimiento
    const authorized = await verifyUserOwnsMovement(user.id, movementId);
    if (!authorized) {
      logger.security(`User ${user.id} attempted to update movement ${movementId}`);
      return NextResponse.json(
        { error: "No autorizado para actualizar este movimiento" },
        { status: 403 }
      );
    }

    const parsedAmount = Number(amount);

    // Preparar datos de actualización
    const updateData: any = {
      amount: parsedAmount,
      description: description || null,
    };

    // Solo actualizar created_at si se proporciona una fecha
    if (date) {
      updateData.created_at = new Date(date).toISOString();
    }

    logger.log("Actualizando movimiento:", movementId, updateData);

    // Actualizar el movimiento
    const { data: updatedData, error: updateError } = await supabase
      .from("ledger_movements")
      .update(updateData)
      .eq("id", movementId)
      .select();

    if (updateError) {
      logger.error("Error al actualizar:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Error al actualizar movimiento" },
        { status: 500 }
      );
    }

    logger.log("Movimiento actualizado:", updatedData);

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
    logger.error("Error completo:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
