import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getUserOrg } from "@/lib/get-user-org";
import { canViewPrices } from "@/lib/permissions";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { EditOrderForm } from "@/components/orders/edit-order-form";

export default async function EditOrderPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  // Only admins or users with order creation rights can edit
  if (isCollaborator && !permissions?.create_orders) redirect("/dashboard");

  const showPrices = canViewPrices(permissions);

  const supabase = await createClient();
  const isDentist = org.type === "dentist";

  // Fetch order with items
  const { data: order } = await supabase
    .from("lab_orders")
    .select(`
      id,
      patient_id,
      status,
      priority,
      due_date,
      notes,
      dentist_org_id,
      lab_org_id,
      items:lab_order_items(
        id,
        work_type,
        tooth_positions,
        shade,
        quantity,
        unit_price,
        selected_extras,
        catalog_item:price_catalog(name)
      )
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  // Security: must belong to org
  if (isDentist && order.dentist_org_id !== org.id) notFound();
  if (!isDentist && order.lab_org_id !== org.id) notFound();

  // Fetch patients for selector
  const { data: patientsRaw } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("dentist_org_id", isDentist ? org.id : order.dentist_org_id)
    .order("first_name");

  const patients = patientsRaw || [];

  // Normalize items: flatten catalog_item join
  const items = (order.items || []).map((item: any) => ({
    id: item.id,
    work_type: item.work_type,
    tooth_positions: Array.isArray(item.tooth_positions)
      ? item.tooth_positions.join(", ")
      : (item.tooth_positions ?? ""),
    shade: item.shade,
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price,
    selected_extras: Array.isArray(item.selected_extras) ? item.selected_extras : [],
    catalog_item_name: Array.isArray(item.catalog_item)
      ? item.catalog_item[0]?.name ?? null
      : item.catalog_item?.name ?? null,
  }));

  const orderData = {
    id: order.id,
    patient_id: order.patient_id,
    status: order.status,
    priority: order.priority || "normal",
    due_date: order.due_date,
    notes: order.notes,
    items,
  };

  return (
    <div className="flex flex-col min-h-screen bg-background/50">
      <DashboardHeader
        title="Editar Orden"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />

      <main className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">
        <Link href={`/dashboard/orders/${id}`}>
          <Button variant="ghost" size="sm" className="hover:bg-muted font-bold text-xs uppercase tracking-wider">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver a la orden
          </Button>
        </Link>

        <EditOrderForm
          order={orderData}
          patients={patients}
          organizationId={org.id}
          isDentist={isDentist}
          showPrices={showPrices}
        />
      </main>
    </div>
  );
}
