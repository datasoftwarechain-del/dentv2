import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function recalculateBalances(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  isDentist: boolean
): Promise<void> {
  logger.log("Recalculando balances para:", { organizationId, clientId, isDentist });

  const orgField    = isDentist ? "dentist_org_id" : "lab_org_id";
  const clientField = isDentist ? "lab_org_id"     : "dentist_org_id";

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total")
    .eq(orgField, organizationId)
    .eq(clientField, clientId)
    // [BLOQUE 3] Voided (soft-deleted) invoices must not contribute to balance.
    .is("invoice_voided_at", null);

  const totalInvoiced =
    invoices?.reduce((sum: number, inv: { total: unknown }) => sum + Number(inv.total), 0) ?? 0;

  logger.log("Total facturado:", totalInvoiced);

  const { data: movements } = await supabase
    .from("ledger_movements")
    .select("*")
    .eq(orgField, organizationId)
    .eq(clientField, clientId)
    .order("created_at", { ascending: true })
    .order("id",         { ascending: true });

  logger.log(`Recalculando ${movements?.length ?? 0} movimientos`);

  let runningBalance = totalInvoiced;

  if (movements) {
    for (const mov of movements) {
      if (mov.type === "charge") {
        runningBalance += Number(mov.amount);
      } else {
        // "payment" and any other type reduce the balance
        runningBalance -= Number(mov.amount);
      }

      logger.log(`Movimiento ${mov.id}: tipo=${mov.type}, monto=${mov.amount}, balance=${runningBalance}`);

      const { error } = await supabase
        .from("ledger_movements")
        .update({ balance: runningBalance })
        .eq("id", mov.id);

      if (error) {
        logger.error(`Error actualizando balance del movimiento ${mov.id}:`, error);
      }
    }
  }

  logger.log("Recalculación completada. Balance final:", runningBalance);
}
