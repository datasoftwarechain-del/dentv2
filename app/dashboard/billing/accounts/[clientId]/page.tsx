import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Get user's organization
  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type, is_system_account)")
    .eq("user_id", user.id);

  const orgs = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any) => o && o.is_system_account !== false);

  const org = orgs[0] || null;
  if (!org) redirect("/dashboard");

  const isDentist = org.type === "dentist";

  // Get client organization details
  const { data: clientOrg } = await supabase
    .from("organizations")
    .select("id, name, type, email, phone")
    .eq("id", resolvedParams.clientId)
    .single();

  if (!clientOrg) redirect("/dashboard/billing");

  // Get all invoices for this client
  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select(`
      *,
      dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
      lab_org:organizations!invoices_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // Fetch order items (with catalog name & extras) for all invoiced orders
  const orderIds = (invoicesRaw || []).map((inv: any) => inv.order_id).filter(Boolean);
  let orderItemsByOrderId: Record<string, any[]> = {};
  if (orderIds.length > 0) {
    const { data: itemsData } = await supabase
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
  const { data: movements } = await supabase
    .from("ledger_movements")
    .select("*")
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // Calculate balance — same logic as UnifiedAccountStatement:
  // charges add to balance, everything else (payments + any other type) reduces it
  const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPaid     = (movements || []).filter(m => m.type === "payment").reduce((sum, m) => sum + Number(m.amount), 0);
  const totalCharges  = (movements || []).filter(m => m.type === "charge").reduce((sum, m) => sum + Number(m.amount), 0);
  const otherCredits  = (movements || []).filter(m => m.type !== "payment" && m.type !== "charge").reduce((sum, m) => sum + Number(m.amount), 0);

  // Mirrors the running balance in UnifiedAccountStatement
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
          organizationId={org.id}
        />
      </div>
    </div>
  );
}
