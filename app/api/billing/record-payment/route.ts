import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsOrganization } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, clientId, amount, description, date, isDentist } = body;

    if (!organizationId || !clientId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Verificar que el usuario pertenece a la organización
    const authorized = await verifyUserOwnsOrganization(user.id, organizationId);
    if (!authorized) {
      console.warn(`[SECURITY] User ${user.id} attempted to record payment for org ${organizationId}`);
      return NextResponse.json(
        { error: "No autorizado para registrar pagos en esta organización" },
        { status: 403 }
      );
    }

    // Calcular balance actual para esta relación específica
    const { data: lastMovement } = await supabase
      .from("ledger_movements")
      .select("balance")
      .eq(isDentist ? "dentist_org_id" : "lab_org_id", organizationId)
      .eq(isDentist ? "lab_org_id" : "dentist_org_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = lastMovement?.balance || 0;
    const parsedAmount = parseFloat(amount);
    // Los cobros/pagos SIEMPRE reducen la deuda (son abonos)
    const newBalance = currentBalance - parsedAmount;

    const insertData = {
      [isDentist ? "dentist_org_id" : "lab_org_id"]: organizationId,
      [isDentist ? "lab_org_id" : "dentist_org_id"]: clientId,
      type: "payment", // Siempre es payment porque es un abono que reduce la deuda
      amount: parsedAmount,
      balance: newBalance,
      description: description || null,
      created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    };

    const { data: insertedData, error } = await supabase
      .from("ledger_movements")
      .insert(insertData)
      .select();

    if (error) {
      console.error("Error al insertar:", error);
      return NextResponse.json(
        { error: error.message || "Error al insertar movimiento" },
        { status: 500 }
      );
    }

    // Revalidar la página del estado de cuenta
    revalidatePath(`/dashboard/billing/accounts/${clientId}`);
    revalidatePath("/dashboard/billing");

    return NextResponse.json({
      success: true,
      data: insertedData,
      message: "Cobro registrado correctamente",
    });
  } catch (error: any) {
    console.error("Error completo:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
