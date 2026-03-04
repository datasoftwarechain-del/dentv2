import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import { DentistBillingDashboard } from "@/components/billing/dentist-billing-dashboard";
import { getUserOrg } from "@/lib/get-user-org";

export default async function BillingPage() {
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_billing) redirect("/dashboard");

  const showAmounts = !isCollaborator || !!permissions?.view_billing_amounts;
  const supabase = await createClient();

  const isDentist = org.type === "dentist";

  // ─── DENTIST BILLING ───────────────────────────────────────
  if (isDentist) {
    // All three queries are independent — run in parallel to eliminate waterfall
    const [
      { data: patientInvoices },
      { data: patients },
      { data: labInvoices },
    ] = await Promise.all([
      // Patient invoices (dentist → patient)
      supabase
        .from("patient_invoices")
        .select("*, patient:patients(id, first_name, last_name)")
        .eq("dentist_org_id", org.id)
        .order("created_at", { ascending: false }),

      // Patients list for the create dialog
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("dentist_org_id", org.id)
        .order("first_name"),

      // Lab invoices (lab → dentist)
      supabase
        .from("invoices")
        .select(`
          *,
          lab_org:organizations!invoices_lab_org_id_fkey(id, name)
        `)
        .eq("dentist_org_id", org.id)
        .order("created_at", { ascending: false }),
    ]);

    // Build lab clients summary
    const labClientsMap = new Map<string, any>();
    (labInvoices || []).forEach((inv: any) => {
      const lab = inv.lab_org;
      if (!lab) return;
      const existing = labClientsMap.get(lab.id) || {
        id: lab.id, name: lab.name, invoiceCount: 0, totalAmount: 0, pendingAmount: 0,
      };
      existing.invoiceCount++;
      existing.totalAmount += Number(inv.total);
      if (inv.status === "pending") existing.pendingAmount += Number(inv.total);
      labClientsMap.set(lab.id, existing);
    });
    const labClients = Array.from(labClientsMap.values());

    // Stats
    const piList = patientInvoices || [];
    const totalPatientInvoiced = piList.reduce((s: number, i: any) => s + Number(i.total), 0);
    const totalPatientPaid = piList.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total), 0);
    const totalPatientPending = piList.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + Number(i.total), 0);
    const totalLabPending = labClients.reduce((s: number, c: any) => s + c.pendingAmount, 0);

    return (
      <div className="flex flex-col">
        <DashboardHeader
          title="Facturación"
          user={{ email: user.email || "", firstName: user.user_metadata?.first_name, lastName: user.user_metadata?.last_name }}
        />
        <div className="flex-1 p-6">
          <DentistBillingDashboard
            organizationId={org.id}
            patients={patients || []}
            patientInvoices={piList}
            labClients={labClients}
            labInvoices={labInvoices || []}
            stats={{ totalPatientInvoiced, totalPatientPaid, totalPatientPending, totalLabPending }}
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
        lab_org:organizations!invoices_lab_org_id_fkey(id, name)
      `)
      .eq("lab_org_id", org.id)
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

  // Latest ledger balance per client (movements already ordered by created_at desc)
  const balanceMap = new Map<string, number>();
  (allMovements || []).forEach((m: any) => {
    if (!balanceMap.has(m.dentist_org_id)) {
      balanceMap.set(m.dentist_org_id, Number(m.balance));
    }
  });

  // Movements for recent display (limit to 20)
  const movements = (allMovements || []).slice(0, 20);

  // Invoice stats
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
  const totalPaid = invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
  const totalPending = invoices?.filter((inv) => inv.status === "pending").reduce((sum, inv) => sum + Number(inv.total), 0) || 0;

  // Build clients from connected dentists (source of truth) + invoice data overlay + ledger balance
  const clientsMap = new Map<string, {
    id: string; name: string; invoiceCount: number; totalAmount: number; paidAmount: number;
  }>();

  // Seed with ALL connected dentists
  connectedDentists.forEach((d) => {
    clientsMap.set(d.id, { id: d.id, name: d.name, invoiceCount: 0, totalAmount: 0, paidAmount: 0 });
  });

  // Overlay invoice data
  invoices?.forEach((invoice) => {
    const clientOrg = invoice.dentist_org as { id: string; name: string } | null;
    if (!clientOrg) return;
    const entry = clientsMap.get(clientOrg.id) ?? {
      id: clientOrg.id, name: clientOrg.name, invoiceCount: 0, totalAmount: 0, paidAmount: 0,
    };
    entry.invoiceCount++;
    entry.totalAmount += Number(invoice.total);
    if (invoice.status === "paid") entry.paidAmount += Number(invoice.total);
    clientsMap.set(clientOrg.id, entry);
  });

  const clients = Array.from(clientsMap.values()).map((c) => {
    const invoicePending = c.totalAmount - c.paidAmount;
    // If client has no invoices yet, use ledger balance as pending amount
    const ledgerBalance = balanceMap.get(c.id) ?? 0;
    const pendingAmount = c.invoiceCount > 0 ? invoicePending : Math.max(0, ledgerBalance);
    return { ...c, pendingAmount };
  });

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Facturación"
        user={{ email: user.email || "", firstName: user.user_metadata?.first_name, lastName: user.user_metadata?.last_name }}
      />
      <div className="flex-1 p-6">
        <BillingDashboard
          invoices={invoices || []}
          movements={movements || []}
          isDentist={false}
          organizationId={org.id}
          clients={clients}
          connectedDentists={connectedDentists}
          stats={{ totalInvoiced, totalPaid, totalPending }}
        />
      </div>
    </div>
  );
}
