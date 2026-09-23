import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { DesignQueueBoard } from "@/components/design/design-queue-board";
import { DESIGN_KANBAN_COLUMNS } from "@/lib/design/status";

/** [035_design_studio] Tablero de trabajo del equipo de diseño. */
export default async function DesignQueuePage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "design_studio") redirect("/dashboard");
  if (isCollaborator && !permissions?.manage_design_queue) redirect("/dashboard/design");

  const supabase = await createClient();

  const [{ data: orders }, { data: members }] = await Promise.all([
    supabase
      .from("design_orders")
      .select(`
        id, order_number, status, priority, patient_ref, due_at,
        revision_count, assigned_to,
        client_org:client_org_id(id, name),
        items:design_order_items(service_code)
      `)
      .eq("studio_org_id", org.id)
      .in("status", DESIGN_KANBAN_COLUMNS.map((c) => c.id))
      // Lo urgente primero, y dentro de eso lo que vence antes.
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from("org_members")
      .select("user_id, display_name")
      .eq("org_id", org.id)
      .eq("status", "active"),
  ]);

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Cola de diseño"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <DesignQueueBoard
          orders={(orders ?? []) as any[]}
          designers={(members ?? []) as any[]}
        />
      </div>
    </div>
  );
}
