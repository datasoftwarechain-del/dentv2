import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ClientAccountStatement } from "@/components/billing/client-account-statement";

interface PageProps {
  params: Promise<{
    clientId: string;
  }>;
}

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
    .select("*")
    .eq("id", resolvedParams.clientId)
    .single();

  if (!clientOrg) redirect("/dashboard/billing");

  // Get all invoices for this client
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      *,
      dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
      lab_org:organizations!invoices_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // Get ledger movements for this client
  const { data: movements } = await supabase
    .from("ledger_movements")
    .select("*")
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // Calculate balance from invoices and payments
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
  // Total pagado = suma de todos los cobros/pagos registrados
  const totalPaid = movements?.filter(m => m.type === "payment").reduce((sum, m) => sum + Number(m.amount), 0) || 0;

  // Calculate REAL balance from ledger (último balance registrado)
  const { data: lastMovement } = await supabase
    .from("ledger_movements")
    .select("balance")
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .eq(isDentist ? "lab_org_id" : "dentist_org_id", resolvedParams.clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // El saldo real es el último balance del ledger, O si no hay movimientos, usar facturas pendientes
  const balance = lastMovement?.balance || (totalInvoiced - totalPaid);

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
