import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { DesignClientsSection } from "@/components/design/design-clients-section";

/** [035_design_studio] Cartera de clientes del estudio de diseño. */
export default async function DesignClientsPage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "design_studio") redirect("/dashboard");
  if (isCollaborator && !permissions?.manage_design_clients) redirect("/dashboard/design");

  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("design_studio_clients")
    .select("*, client_org:client_org_id(id, name, type)")
    .eq("studio_org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Clientes"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <DesignClientsSection clients={(clients ?? []) as any[]} />
      </div>
    </div>
  );
}
