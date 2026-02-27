import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserOwnsOrganization } from "@/lib/auth-utils";
import { recalculateBalances } from "@/lib/balance-utils";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";

const AdjustBalanceSchema = z.object({
  organizationId: z.string().uuid("organizationId debe ser un UUID válido"),
  clientId: z.string().uuid("clientId debe ser un UUID válido"),
  targetBalance: z.coerce.number(),
  description: z.string().max(500).optional(),
  isDentist: z.boolean(),
});

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateBody(request, AdjustBalanceSchema);
    if (validation.error) return validation.error;
    const { organizationId, clientId, targetBalance, description, isDentist } = validation.data;

    const authorized = await verifyUserOwnsOrganization(user.id, organizationId);
    if (!authorized) {
      return NextResponse.json(
        { error: "No autorizado para ajustar el saldo de esta organización" },
        { status: 403 }
      );
    }

    // Calcular balance actual
    const { data: invoices } = await supabase
      .from("invoices")
      .select("total")
      .eq(isDentist ? "dentist_org_id" : "lab_org_id", organizationId)
      .eq(isDentist ? "lab_org_id" : "dentist_org_id", clientId);

    const { data: movements } = await supabase
      .from("ledger_movements")
      .select("type, amount")
      .eq(isDentist ? "dentist_org_id" : "lab_org_id", organizationId)
      .eq(isDentist ? "lab_org_id" : "dentist_org_id", clientId);

    const totalInvoiced = invoices?.reduce((s, inv) => s + Number(inv.total), 0) || 0;
    const totalPayments = movements?.filter(m => m.type === "payment").reduce((s, m) => s + Number(m.amount), 0) || 0;
    const totalCharges  = movements?.filter(m => m.type === "charge").reduce((s, m) => s + Number(m.amount), 0) || 0;
    const currentBalance = totalInvoiced + totalCharges - totalPayments;

    const parsedTarget = Number(targetBalance);
    const diff = parsedTarget - currentBalance;

    if (Math.abs(diff) < 0.01) {
      return NextResponse.json({ success: true, message: "El saldo ya es el indicado" });
    }

    // diff > 0 → aumentar saldo (cargo); diff < 0 → reducir saldo (pago)
    const movType  = diff > 0 ? "charge" : "payment";
    const movAmount = Math.abs(diff);
    const newBalance = parsedTarget;

    const insertData: any = {
      [isDentist ? "dentist_org_id" : "lab_org_id"]: organizationId,
      [isDentist ? "lab_org_id" : "dentist_org_id"]: clientId,
      type: movType,
      amount: movAmount,
      balance: newBalance,
      description: description || "Ajuste manual de saldo",
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("ledger_movements").insert(insertData);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalcular todos los balances en orden cronológico
    await recalculateBalances(supabase, organizationId, clientId, isDentist);

    revalidatePath(`/dashboard/billing/accounts/${clientId}`);
    revalidatePath("/dashboard/billing");

    return NextResponse.json({ success: true, message: "Saldo ajustado correctamente" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
