import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserOrg } from "@/lib/get-user-org";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ClientAccountStatement } from "@/components/billing/client-account-statement";

interface PageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ClientAccountPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { user, org } = await getUserOrg();
  const supabase = await createClient();

  const isPreview = org.type === "dentist_preview";
  const isDentist = org.type === "dentist" || isPreview;

  // Para preview: resolver el org ID real de la clínica y el lab
  let effectiveOrgId = org.id;
  if (isPreview) {
    const { data: invitation } = await supabase
      .from("client_invitations")
      .select("dentist_org_id")
      .eq("preview_org_id", org.id)
      .eq("status", "active")
      .single();
    if (!invitation) redirect("/dashboard/billing");
    effectiveOrgId = invitation.dentist_org_id;
  }

  // Preview users' JWT belongs to the preview org — RLS blocks access to lab/dentist data.
  // Use admin client for authorized preview reads.
  const db = isPreview ? createAdminClient() : supabase;

  // Get client organization details
  const { data: clientOrg } = await db
    .from("organizations")
    .select("id, name, type, email, phone")
    .eq("id", resolvedParams.clientId)
    .single();

  if (!clientOrg) redirect("/dashboard/billing");

  // Get all invoices for this client
  const { data: invoicesRaw } = await db
    .from("invoices")
    .select(`
      *,
      dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
      lab_org:organizations!invoices_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", effectiveOrgId)
    .order("created_at", { ascending: false });

  // Fetch order items (with catalog name & extras) for all invoiced orders
  const orderIds = (invoicesRaw || []).map((inv: any) => inv.order_id).filter(Boolean);
  let orderItemsByOrderId: Record<string, any[]> = {};
  if (orderIds.length > 0) {
    const { data: itemsData } = await db
      .from("lab_order_items")
      .select("id, order_id, work_type, unit_price, quantity, selected_extras, catalog_item:price_catalog(name, base_price)")
      .in("order_id", orderIds);
    for (const item of (itemsData || [])) {
      if (!orderItemsByOrderId[item.order_id]) orderItemsByOrderId[item.order_id] = [];
      orderItemsByOrderId[item.order_id].push(item);
    }
  }

  // Merge order items into each invoice
  const invoices = (invoicesRaw || []).map((inv: any) => ({
    ...inv,
    order_items: orderItemsByOrderId[inv.order_id] || [],
  }));

  // Get ledger movements for this client
  const { data: movements } = await db
    .from("ledger_movements")
    .select("*")
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", effectiveOrgId)
    .order("created_at", { ascending: false });

  // Calculate balance
  const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPaid     = (movements || []).filter((m: any) => m.type === "payment").reduce((sum, m: any) => sum + Number(m.amount), 0);
  const totalCharges  = (movements || []).filter((m: any) => m.type === "charge").reduce((sum, m: any) => sum + Number(m.amount), 0);
  const otherCredits  = (movements || []).filter((m: any) => m.type !== "payment" && m.type !== "charge").reduce((sum, m: any) => sum + Number(m.amount), 0);
  const balance = totalInvoiced + totalCharges - totalPaid - otherCredits;

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title={`Estado de Cuenta - ${clientOrg.name}`}
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <ClientAccountStatement
          client={clientOrg}
          invoices={invoices || []}
          movements={movements || []}
          isDentist={isDentist}
          balance={balance}
          totalInvoiced={totalInvoiced}
          totalPaid={totalPaid}
          organizationId={effectiveOrgId}
          isReadOnly={isPreview}
        />
      </div>
    </div>
  );
}
