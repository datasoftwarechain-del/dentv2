import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { DesignersInbox } from "@/components/design/designers-inbox";
import type { DesignApplication, DesignApplicationStatus } from "@/lib/design/applications";

const STATUSES: DesignApplicationStatus[] = ["pending_review", "approved", "rejected"];

/**
 * [042_designers] Bandeja de postulaciones de diseñadores.
 *
 * Solo el estudio. Revisar exige manage_design_clients: aprobar a alguien
 * lo habilita como destinatario de casos reales, que es la misma clase de
 * decisión que dar de alta un cliente.
 */
export default async function DesignersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "design_studio") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_design_studio) redirect("/dashboard");

  const status: DesignApplicationStatus = STATUSES.includes(sp.status as DesignApplicationStatus)
    ? (sp.status as DesignApplicationStatus)
    : "pending_review";

  const canReview = !isCollaborator || Boolean(permissions?.manage_design_clients);

  const supabase = await createClient();

  const [{ data: applications }, { data: pending }] = await Promise.all([
    supabase
      .from("design_applications")
      .select("*")
      .eq("studio_org_id", org.id)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("design_applications")
      .select("id")
      .eq("studio_org_id", org.id)
      .eq("status", "pending_review"),
  ]);

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Diseñadores"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <DesignersInbox
          applications={(applications ?? []) as DesignApplication[]}
          pendingCount={pending?.length ?? 0}
          status={status}
          canReview={canReview}
        />
      </div>
    </div>
  );
}
