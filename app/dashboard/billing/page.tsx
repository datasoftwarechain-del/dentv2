import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import { DentistBillingDashboard } from "@/components/billing/dentist-billing-dashboard";
import { getUserOrg } from "@/lib/get-user-org";
import {
  sanitizeInvoiceForCollaborator,
  canManageBilling,
  canManagePurchases,
  canManageInventory,
  hasPermission,
} from "@/lib/permissions";

export default async function BillingPage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_billing) redirect("/dashboard");

  const showAmounts = !isCollaborator || !!permissions?.view_billing_amounts;
  // [BLOQUE 2.5] Aggregates collapse to 0 when caller can't see amounts.
  // The invoice arrays passed to client components are sanitized below.
  const canViewAmounts = !isCollaborator || !!permissions?.view_billing_amounts;
  // [BLOQUE 3] Drives the "Anular factura" button visibility.
  const canManageBillingFlag = canManageBilling(permissions);
  const supabase = await createClient();

  const isPreview = org.type === "dentist_preview";
  const isDentist = org.type === "dentist" || isPreview;

  // Para preview: resolver org real + lab org desde client_invitations
  let effectiveOrgId = org.id;
  let previewLabOrgId: string | null = null;

  // Admin client bypasses RLS — used for both invitation lookup and data queries for preview users
  const db = isPreview ? createAdminClient() : supabase;

  if (isPreview) {
    const { data: invitation } = await db
      .from("client_invitations")
      .select("dentist_org_id, lab_org_id")
      .eq("preview_org_id", org.id)
      .eq("status", "active")
      .single();
    if (!invitation) redirect("/dashboard");
    effectiveOrgId = invitation.dentist_org_id;
    previewLabOrgId = invitation.lab_org_id;
  }

  // ─── DENTIST BILLING ───────────────────────────────────────
  if (isDentist) {
    // Queries paralelas según tipo de org
    const [
      { data: patientInvoices },
      { data: patients },
      { data: labInvoices },
      ledgerResult,
      labOrgResult,
    ] = await Promise.all([
      // Facturas a pacientes — vacío para preview (ellos no facturan pacientes)
      isPreview
        ? Promise.resolve({ data: [] })
        : supabase
            .from("patient_invoices")
            .select("*, patient:patients(id, first_name, last_name)")
            .eq("dentist_org_id", effectiveOrgId)
            .order("created_at", { ascending: false }),

      // Listado de pacientes — vacío para preview
      isPreview
        ? Promise.resolve({ data: [] })
        : supabase
            .from("patients")
            .select("id, first_name, last_name")
            .eq("dentist_org_id", effectiveOrgId)
            .order("first_name"),

      // Facturas formales (lab → clínica). [BLOQUE 3] Excluye voided.
      // [032_orders_delivered_at] JOIN a lab_orders para que la UI lea
      // delivered_at vivo en vez del snapshot de delivery_date.
      db
        .from("invoices")
        .select(`
          *,
          lab_org:organizations!invoices_lab_org_id_fkey(id, name),
          lab_order:lab_orders!invoices_order_id_fkey(delivered_at)
        `)
        .eq("dentist_org_id", effectiveOrgId)
        .is("invoice_voided_at", null)
        .order("created_at", { ascending: false }),

      // Movimientos del libro mayor — saldo real de la cuenta con el lab (solo preview)
      isPreview && previewLabOrgId
        ? db
            .from("ledger_movements")
            .select("*")
            .eq("dentist_org_id", effectiveOrgId)
            .eq("lab_org_id", previewLabOrgId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),

      // Nombre del lab para preview (para mostrar en el card de cuenta)
      isPreview && previewLabOrgId
        ? db
            .from("organizations")
            .select("id, name")
            .eq("id", previewLabOrgId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    // Enriquecer labInvoices con order_items (para mostrar nombre del catálogo)
    const labOrderIds = (labInvoices || []).map((inv: any) => inv.order_id).filter(Boolean);
    let labOrderItemsByOrderId: Record<string, any[]> = {};
    if (labOrderIds.length > 0) {
      const { data: labItemsData } = await db
        .from("lab_order_items")
        .select("id, order_id, work_type, catalog_item:price_catalog(name)")
        .in("order_id", labOrderIds);
      for (const item of (labItemsData || [])) {
        if (!labOrderItemsByOrderId[item.order_id]) labOrderItemsByOrderId[item.order_id] = [];
        labOrderItemsByOrderId[item.order_id].push(item);
      }
    }
    const labInvoicesEnriched = (labInvoices || []).map((inv: any) => ({
      ...inv,
      order_items: labOrderItemsByOrderId[inv.order_id] || [],
    }));

    // Construir resumen por lab desde facturas formales — montos colapsan a 0 sin permiso
    const labClientsMap = new Map<string, any>();
    (labInvoices || []).forEach((inv: any) => {
      const lab = Array.isArray(inv.lab_org) ? inv.lab_org[0] : inv.lab_org;
      if (!lab) return;
      const existing = labClientsMap.get(lab.id) || {
        id: lab.id, name: lab.name, invoiceCount: 0, totalAmount: 0, pendingAmount: 0,
      };
      existing.invoiceCount++;
      if (canViewAmounts) {
        existing.totalAmount += Number(inv.total);
        if (inv.status === "pending") existing.pendingAmount += Number(inv.total);
      }
      labClientsMap.set(lab.id, existing);
    });

    // Para preview: si no hay facturas formales, usar el saldo del libro mayor
    if (isPreview && labClientsMap.size === 0 && previewLabOrgId) {
      const labOrg = labOrgResult.data as { id: string; name: string } | null;
      const movements = (ledgerResult.data || []) as any[];
      // El primer movimiento (más reciente) tiene el saldo actual
      const latestBalance = movements.length > 0 ? Number(movements[0].balance) : 0;
      if (labOrg) {
        labClientsMap.set(labOrg.id, {
          id: labOrg.id,
          name: labOrg.name,
          invoiceCount: 0,
          totalAmount: latestBalance,
          pendingAmount: latestBalance,
        });
      }
    }

    const labClients = Array.from(labClientsMap.values());

    // Stats — colapsan a 0 si el colaborador no puede ver montos
    const piList = patientInvoices || [];
    const totalPatientInvoiced = canViewAmounts
      ? piList.reduce((s: number, i: any) => s + Number(i.total), 0) : 0;
    const totalPatientPaid = canViewAmounts
      ? piList.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total), 0) : 0;
    const totalPatientPending = canViewAmounts
      ? piList.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + Number(i.total), 0) : 0;
    const totalLabPending = canViewAmounts
      ? labClients.reduce((s: number, c: any) => s + c.pendingAmount, 0) : 0;

    // [BLOQUE 2.5] Sanitize before passing to client. labInvoices come from
    // the lab→dentist `invoices` table; patientInvoices live in patient_invoices
    // (different shape, different sanitizer if needed — out of scope here).
    const sanitizedLabInvoices = labInvoicesEnriched.map((inv: any) =>
      sanitizeInvoiceForCollaborator(inv, permissions)
    );

    return (
      <div className="flex flex-col">
        <DashboardHeader
          title="Facturación"
          user={{ email: user.email || "", firstName: user.user_metadata?.first_name, lastName: user.user_metadata?.last_name }}
        />
        <div className="flex-1 p-6">
          <DentistBillingDashboard
            organizationId={effectiveOrgId}
            patients={patients || []}
            patientInvoices={piList}
            labClients={labClients}
            labInvoices={sanitizedLabInvoices}
            stats={{ totalPatientInvoiced, totalPatientPaid, totalPatientPending, totalLabPending }}
            isReadOnly={isPreview}
          />
        </div>
      </div>
    );
  }

  // ─── LAB BILLING ──────────────────────────────────────────
  // All four queries run in parallel
  const [
    { data: invoices },
    { data: allMovements },
    { data: dentistRelations },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select(`
        *,
        dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
        lab_org:organizations!invoices_lab_org_id_fkey(id, name),
        lab_order:lab_orders!invoices_order_id_fkey(delivered_at)
      `)
      .eq("lab_org_id", org.id)
      .is("invoice_voided_at", null) // [BLOQUE 3]
      .order("created_at", { ascending: false }),

    // All movements (for per-client balance + recent display)
    supabase
      .from("ledger_movements")
      .select("*")
      .eq("lab_org_id", org.id)
      .order("created_at", { ascending: false }),

    // Connected dentist org IDs — source of truth for client list
    supabase
      .from("lab_dentist_relations")
      .select("dentist_org_id")
      .eq("lab_org_id", org.id),
  ]);

  // Fetch org names for all connected dentists (avoids FK hint issues)
  const dentistOrgIds = [...new Set(
    (dentistRelations || []).map((r: any) => r.dentist_org_id).filter(Boolean)
  )] as string[];
  const { data: dentistOrgsData } = dentistOrgIds.length > 0
    ? await supabase.from("organizations").select("id, name").in("id", dentistOrgIds).order("name")
    : { data: [] };
  const connectedDentists = (dentistOrgsData || []) as { id: string; name: string }[];

  // Fetch order items for invoices — enables extras display in InvoiceDetail
  const invoiceOrderIds = (invoices || []).map((inv: any) => inv.order_id).filter(Boolean) as string[];
  let orderItemsByOrderId: Record<string, any[]> = {};
  if (invoiceOrderIds.length > 0) {
    const { data: orderItemsData } = await supabase
      .from("lab_order_items")
      .select("id, order_id, work_type, unit_price, quantity, selected_extras, catalog_item:price_catalog(name, base_price)")
      .in("order_id", invoiceOrderIds);
    for (const item of (orderItemsData || [])) {
      if (!orderItemsByOrderId[item.order_id]) orderItemsByOrderId[item.order_id] = [];
      orderItemsByOrderId[item.order_id].push(item);
    }
  }
  const invoicesWithItems = (invoices || []).map((inv: any) => ({
    ...inv,
    order_items: orderItemsByOrderId[inv.order_id] || [],
  }));

  // Latest ledger balance per client (movements already ordered by created_at desc)
  const balanceMap = new Map<string, number>();
  (allMovements || []).forEach((m: any) => {
    if (!balanceMap.has(m.dentist_org_id)) {
      balanceMap.set(m.dentist_org_id, Number(m.balance));
    }
  });

  // Movements for recent display (limit to 20)
  const movements = (allMovements || []).slice(0, 20);

  // Invoice stats — colapsan a 0 sin view_billing_amounts
  const totalInvoiced = canViewAmounts
    ? invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0 : 0;
  const totalPaid = canViewAmounts
    ? invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total), 0) || 0 : 0;
  const totalPending = canViewAmounts
    ? invoices?.filter((inv) => inv.status === "pending").reduce((sum, inv) => sum + Number(inv.total), 0) || 0 : 0;

  // Build clients from connected dentists (source of truth) + invoice data overlay + ledger balance
  const clientsMap = new Map<string, {
    id: string; name: string; invoiceCount: number; totalAmount: number; paidAmount: number;
  }>();

  // Seed with ALL connected dentists
  connectedDentists.forEach((d) => {
    clientsMap.set(d.id, { id: d.id, name: d.name, invoiceCount: 0, totalAmount: 0, paidAmount: 0 });
  });

  // Overlay invoice data — montos solo si canViewAmounts
  invoices?.forEach((invoice) => {
    const clientOrg = invoice.dentist_org as { id: string; name: string } | null;
    if (!clientOrg) return;
    const entry = clientsMap.get(clientOrg.id) ?? {
      id: clientOrg.id, name: clientOrg.name, invoiceCount: 0, totalAmount: 0, paidAmount: 0,
    };
    entry.invoiceCount++;
    if (canViewAmounts) {
      entry.totalAmount += Number(invoice.total);
      if (invoice.status === "paid") entry.paidAmount += Number(invoice.total);
    }
    clientsMap.set(clientOrg.id, entry);
  });

  const clients = Array.from(clientsMap.values()).map((c) => {
    const invoicePending = c.totalAmount - c.paidAmount;
    // If client has no invoices yet, use ledger balance as pending amount
    const ledgerBalance = balanceMap.get(c.id) ?? 0;
    const pendingAmount = c.invoiceCount > 0 ? invoicePending : Math.max(0, ledgerBalance);
    return { ...c, pendingAmount };
  });

  // [BLOQUE 2.5] Sanitize the lab→dentist invoices array before passing to client.
  const sanitizedInvoices = invoicesWithItems.map((inv: any) =>
    sanitizeInvoiceForCollaborator(inv, permissions)
  );

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Facturación"
        user={{ email: user.email || "", firstName: user.user_metadata?.first_name, lastName: user.user_metadata?.last_name }}
      />
      <div className="flex-1 p-6">
        <BillingDashboard
          invoices={sanitizedInvoices}
          movements={movements || []}
          isDentist={false}
          organizationId={org.id}
          clients={clients}
          connectedDentists={connectedDentists}
          stats={{ totalInvoiced, totalPaid, totalPending }}
          canManageBilling={canManageBillingFlag}
          canViewPurchases={hasPermission(permissions, "view_purchases")}
          canManagePurchases={canManagePurchases(permissions)}
          canViewInventory={hasPermission(permissions, "view_inventory")}
          canManageInventory={canManageInventory(permissions)}
          canViewFinancialDashboard={hasPermission(permissions, "view_financial_dashboard")}
          canViewAmounts={canViewAmounts}
        />
      </div>
    </div>
  );
}
