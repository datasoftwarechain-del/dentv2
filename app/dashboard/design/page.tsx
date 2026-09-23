import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { DesignOrdersList } from "@/components/design/design-orders-list";
import { Plus } from "lucide-react";

/**
 * [035_design_studio] Listado de órdenes de diseño.
 *
 * La misma pantalla sirve a los dos lados: la RLS de 035 ya devuelve solo
 * lo que la organización puede ver, y `side` decide si se muestra la
 * columna "Cliente" o la columna "Estudio".
 */
export default async function DesignOrdersPage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (isCollaborator && !permissions?.view_design_studio) redirect("/dashboard");
  if (org.type === "dentist_preview") redirect("/dashboard");

  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("design_orders")
    .select(`
      id, order_number, status, priority, patient_ref, due_at,
      created_at, revision_count, studio_org_id, client_org_id,
      client_org:client_org_id(id, name),
      studio_org:studio_org_id(id, name),
      items:design_order_items(service_code, quantity)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const isStudio = org.type === "design_studio";

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title={isStudio ? "Órdenes de diseño" : "Diseño Digital"}
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/dashboard/design/new">
              <Plus className="mr-2 h-4 w-4" />
              {isStudio ? "Nueva orden" : "Pedir un diseño"}
            </Link>
          </Button>
        </div>

        <DesignOrdersList orders={(orders ?? []) as any[]} isStudio={isStudio} />
      </div>
    </div>
  );
}
