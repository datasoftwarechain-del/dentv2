import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import { DentistBillingDashboard } from "@/components/billing/dentist-billing-dashboard";

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Get user's organizations
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

  // ─── DENTIST BILLING ───────────────────────────────────────
  if (isDentist) {
    // Patient invoices (dentist → patient)
    const { data: patientInvoices } = await supabase
      .from("patient_invoices")
      .select("*, patient:patients(id, first_name, last_name)")
      .eq("dentist_org_id", org.id)
      .order("created_at", { ascending: false });

    // Patients list for the create dialog
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("dentist_org_id", org.id)
      .order("first_name");

    // Lab invoices (lab → dentist)
    const { data: labInvoices } = await supabase
      .from("invoices")
      .select(`
        *,
        lab_org:organizations!invoices_lab_org_id_fkey(id, name)
      `)
      .eq("dentist_org_id", org.id)
      .order("created_at", { ascending: false });

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

  // ─── LAB BILLING (unchanged) ──────────────────────────────
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      *,
      dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
      lab_org:organizations!invoices_lab_org_id_fkey(id, name)
    `)
    .eq("lab_org_id", org.id)
    .order("created_at", { ascending: false });

  const { data: movements } = await supabase
    .from("ledger_movements")
    .select("*")
    .eq("lab_org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
  const totalPaid = invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
  const totalPending = invoices?.filter((inv) => inv.status === "pending").reduce((sum, inv) => sum + Number(inv.total), 0) || 0;

  const clientsMap = new Map();
  invoices?.forEach((invoice) => {
    const clientOrg = invoice.dentist_org;
    if (clientOrg && !clientsMap.has(clientOrg.id)) {
      const clientInvoices = invoices.filter(inv => inv.dentist_org?.id === clientOrg.id);
      const clientTotal = clientInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const clientPaid = clientInvoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total), 0);
      clientsMap.set(clientOrg.id, {
        ...clientOrg,
        invoiceCount: clientInvoices.length,
        totalAmount: clientTotal,
        pendingAmount: clientTotal - clientPaid,
      });
    }
  });
  const clients = Array.from(clientsMap.values());

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
          stats={{ totalInvoiced, totalPaid, totalPending }}
        />
      </div>
    </div>
  );
}
