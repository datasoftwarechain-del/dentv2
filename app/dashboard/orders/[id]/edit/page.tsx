import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getUserOrg } from "@/lib/get-user-org";
import { canViewPrices, canEditOrders, canManageBilling } from "@/lib/permissions";
import { getEffectivePricesBatch } from "@/lib/pricing";
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

  // [BLOQUE 2] Visiting the edit page requires view_orders. Without it, redirect.
  if (isCollaborator && !permissions?.view_orders) redirect("/dashboard");

  // [BLOQUE 2] Saving requires edit_orders. Form renders read-only when this is false.
  const canEdit = canEditOrders(permissions);
  const showPrices = canViewPrices(permissions);
  // [BLOQUE 8 ext] Sync invoice from edit form requires manage_billing.
  const canSyncInvoice = canManageBilling(permissions);

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
        catalog_item_id,
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

  // Fetch lab's price catalog for the work type selector
  const labOrgId = isDentist ? order.lab_org_id : org.id;
  const { data: catalogRaw } = labOrgId
    ? await supabase
        .from("price_catalog")
        .select("id, name, base_price, category")
        .eq("org_id", labOrgId)
        .eq("is_active", true)
        .order("category")
        .order("name")
    : { data: [] };
  const baseCatalog = (catalogRaw || []) as { id: string; name: string; base_price: number; category: string }[];

  // [BLOQUE 4] Resolve effective price per catalog item for THIS dentist client.
  // Override (if exists) replaces base_price; otherwise base_price stands.
  const orderDentistId = order.dentist_org_id as string | null;
  const overrideMap =
    labOrgId && orderDentistId && baseCatalog.length > 0
      ? await getEffectivePricesBatch(supabase, labOrgId, orderDentistId, baseCatalog)
      : new Map();

  const catalogItems = baseCatalog.map((c) => {
    const eff = overrideMap.get(c.id);
    return {
      ...c,
      effective_price: eff?.effective ?? c.base_price,
      has_override: eff?.hasOverride ?? false,
    };
  });

  // [BLOQUE 8 ext] Detect linked active invoice. Voided invoices are ignored.
  // The form uses this to render a banner + a "Save and sync invoice" action
  // when the order has a live invoice that may drift after editing items.
  const { data: linkedInvoiceRaw } = await supabase
    .from("invoices")
    .select("id, invoice_number, total")
    .eq("order_id", id)
    .is("invoice_voided_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const linkedInvoice = linkedInvoiceRaw
    ? {
        id: linkedInvoiceRaw.id,
        invoice_number: linkedInvoiceRaw.invoice_number,
        total: Number(linkedInvoiceRaw.total) || 0,
      }
    : null;

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
    catalog_item_id: item.catalog_item_id ?? null,
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
          canEdit={canEdit}
          catalogItems={catalogItems}
          linkedInvoice={linkedInvoice}
          dentistOrgId={order.dentist_org_id ?? null}
          canSyncInvoice={canSyncInvoice}
        />
      </main>
    </div>
  );
}
