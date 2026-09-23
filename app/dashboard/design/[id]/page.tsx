import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { DesignOrderDetail } from "@/components/design/design-order-detail";
import { canViewPrices } from "@/lib/permissions";
import { ArrowLeft } from "lucide-react";

/**
 * [035_design_studio] Detalle de una orden de diseño.
 *
 * Arma el payload del lado del servidor en vez de hacer que el cliente
 * llame a la API: la primera pintura llega con todo. Los archivos sí se
 * piden después, porque sus URLs son firmadas y de vida corta.
 */
export default async function DesignOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (isCollaborator && !permissions?.view_design_studio) redirect("/dashboard");

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("design_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // La RLS devuelve null tanto para una orden ajena como para una
  // inexistente. Las dos son un 404: decir cuál filtra información.
  if (!order) notFound();

  const side: "client" | "studio" =
    order.studio_org_id === org.id ? "studio" : order.client_org_id === org.id ? "client" : "none" as never;

  if (side !== "studio" && side !== "client") notFound();

  const [{ data: items }, { data: events }, { data: orgs }, { data: relation }, { data: invoice }] = await Promise.all([
    supabase.from("design_order_items").select("*").eq("design_order_id", id).order("created_at"),
    supabase
      .from("design_order_events")
      .select("*")
      .eq("design_order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name, type")
      .in("id", [order.studio_org_id, order.client_org_id]),
    supabase
      .from("design_studio_clients")
      .select("payment_mode")
      .eq("studio_org_id", order.studio_org_id)
      .eq("client_org_id", order.client_org_id)
      .maybeSingle(),
    // La factura, para poder decirle al cliente cuánto y por qué.
    order.invoice_id
      ? supabase
          .from("invoices")
          .select("id, invoice_number, total, status, due_date")
          .eq("id", order.invoice_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const orgById = new Map((orgs ?? []).map((o: any) => [o.id, o]));

  const detail = {
    ...order,
    // Las notas internas del estudio nunca viajan al cliente.
    internal_notes: side === "studio" ? order.internal_notes : null,
    items: items ?? [],
    files: [],
    events: side === "studio" ? (events ?? []) : (events ?? []).filter((e: any) => !e.is_internal),
    studio_org: orgById.get(order.studio_org_id) ?? null,
    client_org: orgById.get(order.client_org_id) ?? null,
    side,
    payment_mode: (relation?.payment_mode as "account" | "prepaid") ?? "account",
    invoice: invoice ?? null,
    // El cliente siempre ve cuánto paga: es su factura. Del lado del
    // estudio, solo quien tiene permiso de ver precios.
    can_see_amount: side === "client" || canViewPrices(permissions),
  };

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title={order.order_number}
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 space-y-4 p-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/design">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver a las órdenes
          </Link>
        </Button>

        <DesignOrderDetail order={detail as any} />
      </div>
    </div>
  );
}
