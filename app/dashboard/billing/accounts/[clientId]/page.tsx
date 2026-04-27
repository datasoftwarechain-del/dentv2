import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserOrg } from "@/lib/get-user-org";
import {
  sanitizeInvoiceForCollaborator,
  canManageBilling,
  canManagePricing,
  hasPermission,
} from "@/lib/permissions";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ClientAccountStatement } from "@/components/billing/client-account-statement";
import { ClientPricingSection } from "@/components/billing/client-pricing-section";

interface PageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ClientAccountPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  // [BLOQUE 2.5] Section gate: collaborators without view_billing get bounced.
  if (isCollaborator && !permissions?.view_billing) redirect("/dashboard");
  const canViewAmounts = !isCollaborator || !!permissions?.view_billing_amounts;
  const supabase = await createClient();

  const isPreview = org.type === "dentist_preview";
  const isDentist = org.type === "dentist" || isPreview;

  // Para preview: resolver el org ID real de la clínica y el lab
  let effectiveOrgId = org.id;
  // Admin client bypasses RLS — used for both invitation lookup and data queries for preview users
  const db = isPreview ? createAdminClient() : supabase;

  if (isPreview) {
    const { data: invitation } = await db
      .from("client_invitations")
      .select("dentist_org_id")
      .eq("preview_org_id", org.id)
      .eq("status", "active")
      .single();
    if (!invitation) redirect("/dashboard/billing");
    effectiveOrgId = invitation.dentist_org_id;
  }

  // Get client organization details
  const { data: clientOrg } = await db
    .from("organizations")
    .select("id, name, type, email, phone")
    .eq("id", resolvedParams.clientId)
    .single();

  if (!clientOrg) redirect("/dashboard/billing");

  // Get all invoices for this client. [BLOQUE 3] Excluye voided.
  const { data: invoicesRaw } = await db
    .from("invoices")
    .select(`
      *,
      dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
      lab_org:organizations!invoices_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", effectiveOrgId)
    .is("invoice_voided_at", null)
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
  const invoicesEnriched = (invoicesRaw || []).map((inv: any) => ({
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

  // Calculate balance from RAW data — collapse to 0 if caller can't view amounts.
  const totalInvoicedRaw = invoicesEnriched.reduce((sum, inv: any) => sum + Number(inv.total), 0);
  const totalPaidRaw     = (movements || []).filter((m: any) => m.type === "payment").reduce((sum, m: any) => sum + Number(m.amount), 0);
  const totalChargesRaw  = (movements || []).filter((m: any) => m.type === "charge").reduce((sum, m: any) => sum + Number(m.amount), 0);
  const otherCreditsRaw  = (movements || []).filter((m: any) => m.type !== "payment" && m.type !== "charge").reduce((sum, m: any) => sum + Number(m.amount), 0);

  const totalInvoiced = canViewAmounts ? totalInvoicedRaw : 0;
  const totalPaid     = canViewAmounts ? totalPaidRaw : 0;
  const balance       = canViewAmounts
    ? (totalInvoicedRaw + totalChargesRaw - totalPaidRaw - otherCreditsRaw)
    : 0;

  // [BLOQUE 2.5] Sanitize before passing to client.
  const invoices = invoicesEnriched.map((inv: any) =>
    sanitizeInvoiceForCollaborator(inv, permissions)
  );

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
          canManageBilling={canManageBilling(permissions)}
        />

        {/* [BLOQUE 4] Arancel personalizado — solo lab que ve el catálogo. */}
        {!isDentist && !isPreview && hasPermission(permissions, "view_pricing_admin") && (
          <div className="mt-6">
            <ClientPricingSection
              clientId={resolvedParams.clientId}
              clientName={clientOrg.name}
              canManage={canManagePricing(permissions)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
