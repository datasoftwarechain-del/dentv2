import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ORDER_STATUS_KANBAN_COLUMNS } from "@/lib/order-status";

export default async function KanbanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type)")
    .eq("user_id", user.id)
    .single();

  const orgData = membership?.organization as
    | { id: string; name: string; type: string }
    | { id: string; name: string; type: string }[]
    | null
    | undefined;
  const org = Array.isArray(orgData) ? orgData[0] : orgData ?? null;
  if (!org || org.type !== "lab") redirect("/dashboard");

  const { data: orders } = await supabase
    .from("lab_orders")
    .select(`
      *,
      items:lab_order_items(work_type, tooth_positions, shade),
      patient:patients(id, first_name, last_name),
      dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name)
    `)
    .eq("lab_org_id", org.id)
    .in(
      "status",
      ORDER_STATUS_KANBAN_COLUMNS.map((column) => column.id) as unknown as string[]
    )
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Tablero de Produccion"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 overflow-x-auto p-6">
        <KanbanBoard orders={orders || []} />
      </div>
    </div>
  );
}
