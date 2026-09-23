import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { NewDesignOrderForm } from "@/components/design/new-design-order-form";

/**
 * [035_design_studio] Alta de una orden de diseño.
 *
 * Sirve a los dos lados: el cliente pide un diseño a su estudio, y el
 * estudio carga una orden en nombre de un cliente — el caso real de un
 * pedido que entra por teléfono o WhatsApp.
 *
 * La contraparte disponible sale siempre de design_studio_clients, que
 * es la misma tabla que después valida la API. Si la relación no existe,
 * ni siquiera aparece en el desplegable.
 */
export default async function NewDesignOrderPage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type === "dentist_preview") redirect("/dashboard/design");

  const isStudioSide = org.type === "design_studio";

  const requiredPermission = isStudioSide ? "manage_design_queue" : "create_design_orders";
  if (isCollaborator && !permissions?.[requiredPermission]) redirect("/dashboard/design");

  const supabase = await createClient();

  const { data: relations } = isStudioSide
    ? await supabase
        .from("design_studio_clients")
        .select("client_org:client_org_id(id, name)")
        .eq("studio_org_id", org.id)
        .eq("status", "active")
    : await supabase
        .from("design_studio_clients")
        .select("studio_org:studio_org_id(id, name)")
        .eq("client_org_id", org.id)
        .eq("status", "active");

  const counterparts = (relations ?? [])
    .map((r: any) => {
      const value = isStudioSide ? r.client_org : r.studio_org;
      return Array.isArray(value) ? value[0] : value;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name)) as { id: string; name: string }[];

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title={isStudioSide ? "Nueva orden" : "Pedir un diseño"}
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <NewDesignOrderForm
          counterparts={counterparts}
          side={isStudioSide ? "studio" : "client"}
        />
      </div>
    </div>
  );
}
