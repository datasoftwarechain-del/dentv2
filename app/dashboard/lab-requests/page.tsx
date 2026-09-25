import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { LabRequestsInbox } from "@/components/lab-requests/lab-requests-inbox";
import type { LabRequest } from "@/lib/lab-requests/types";
import type { LabRequestStatus } from "@/lib/lab-requests/status";

const STATUSES: LabRequestStatus[] = ["pending_review", "converted", "rejected"];

/**
 * [040_lab_requests] Bandeja de solicitudes web del laboratorio.
 *
 * Solo orgs 'lab'. Colaboradores: ver exige view_orders, convertir
 * create_orders, rechazar edit_orders. Los precios se pasan solo si
 * puede verlos: un colaborador sin view_prices no recibe montos.
 */
export default async function LabRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "lab") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_orders) redirect("/dashboard");

  const status: LabRequestStatus = STATUSES.includes(sp.status as LabRequestStatus)
    ? (sp.status as LabRequestStatus)
    : "pending_review";

  const canConvert = !isCollaborator || Boolean(permissions?.create_orders);
  const canReject = !isCollaborator || Boolean(permissions?.edit_orders);
  const canViewPrices = !isCollaborator || Boolean(permissions?.view_prices);

  const supabase = await createClient();

  const [{ data: requests }, { data: counts }, { data: relations }] = await Promise.all([
    supabase
      .from("lab_requests")
      .select("*")
      .eq("lab_org_id", org.id)
      // 'converting' es transitorio: se lista junto a las pendientes.
      .in("status", status === "pending_review" ? ["pending_review", "converting"] : [status])
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("lab_requests")
      .select("status")
      .eq("lab_org_id", org.id)
      .in("status", ["pending_review", "converting"]),
    supabase
      .from("lab_dentist_relations")
      .select("dentist:dentist_org_id(id, name, email)")
      .eq("lab_org_id", org.id)
      .eq("status", "active"),
  ]);

  const clinics = (relations ?? [])
    .map((r: any) => (Array.isArray(r.dentist) ? r.dentist[0] : r.dentist))
    .filter((c: any): c is { id: string; name: string; email: string | null } => Boolean(c?.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Precio vigente del ítem de catálogo de cada solicitud (solo si puede verlos).
  let catalogPrices: Record<string, number> = {};
  if (canViewPrices) {
    const ids = Array.from(new Set((requests ?? []).map((r) => r.catalog_item_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: items } = await supabase
        .from("price_catalog")
        .select("id, base_price")
        .in("id", ids);
      catalogPrices = Object.fromEntries((items ?? []).map((i) => [i.id, Number(i.base_price)]));
    }
  }

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Solicitudes web"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <LabRequestsInbox
          requests={(requests ?? []) as LabRequest[]}
          pendingCount={counts?.length ?? 0}
          status={status}
          clinics={clinics}
          catalogPrices={catalogPrices}
          canConvert={canConvert}
          canReject={canReject}
          canViewPrices={canViewPrices}
        />
      </div>
    </div>
  );
}
