import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { DesignAnalytics } from "@/components/design/design-analytics";
import {
  turnaroundHours, deliveryHours, onTimeRate, needsInfoRate,
  revisionsPerOrder, breakdownByService, breakdownByDesigner, studioTotals,
  type MetricOrderRow,
} from "@/lib/design/metrics";

/**
 * [035_design_studio] Tablero de números del estudio.
 *
 * Las métricas se calculan en el servidor con funciones puras
 * (lib/design/metrics.ts) sobre las filas ya traídas. No hay agregaciones
 * en SQL: el mismo cálculo que corre acá es el que cubren los tests.
 */
export default async function DesignAnalyticsPage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "design_studio") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_design_studio) redirect("/dashboard");

  // Los montos son información sensible: un diseñador no tiene por qué
  // ver el margen del estudio. La operación (tiempos, revisiones) sí.
  const showAmounts = !isCollaborator || !!permissions?.view_financial_dashboard;

  const supabase = await createClient();

  const [{ data: orders }, { data: needsInfoEvents }, { data: members }] = await Promise.all([
    supabase
      .from("design_orders")
      .select(`
        id, status, submitted_at, first_delivery_at, approved_at, delivered_at,
        due_at, revision_count, assigned_to,
        items:design_order_items(service_code, quantity, unit_price, unit_cost, is_revision_fee)
      `)
      .eq("studio_org_id", org.id)
      .neq("status", "draft")
      .limit(1000),
    // Una orden que ya volvió a 'submitted' no deja rastro en su estado
    // actual: la tasa de faltantes se lee de la bitácora, no del estado.
    supabase
      .from("design_order_events")
      .select("design_order_id")
      .eq("to_status", "needs_info"),
    supabase
      .from("org_members")
      .select("user_id, display_name")
      .eq("org_id", org.id),
  ]);

  const rows = (orders ?? []) as unknown as MetricOrderRow[];
  const needsInfoIds = new Set((needsInfoEvents ?? []).map((e: any) => e.design_order_id));
  const nameByUser = new Map(
    (members ?? []).map((m: any) => [m.user_id, m.display_name as string | null]),
  );

  const byDesigner = breakdownByDesigner(rows).map((d) => ({
    ...d,
    name: nameByUser.get(d.userId) ?? "Sin nombre",
  }));

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Análisis del estudio"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <DesignAnalytics
          totals={studioTotals(rows)}
          turnaround={turnaroundHours(rows)}
          delivery={deliveryHours(rows)}
          onTime={onTimeRate(rows)}
          needsInfo={needsInfoRate(rows, needsInfoIds)}
          revisions={revisionsPerOrder(rows)}
          byService={breakdownByService(rows)}
          byDesigner={byDesigner}
          showAmounts={showAmounts}
        />
      </div>
    </div>
  );
}
