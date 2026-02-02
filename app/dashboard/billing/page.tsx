import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { BillingDashboard } from "@/components/billing/billing-dashboard";

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name, type)")
    .eq("user_id", user.id)
    .single();

  const org = membership?.organization as { id: string; name: string; type: string } | null;
  if (!org) redirect("/dashboard");

  const isDentist = org.type === "dentist";

  // Get invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      *,
      dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
      lab_org:organizations!invoices_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // Get ledger movements for balance
  const { data: movements } = await supabase
    .from("ledger_movements")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Calculate totals
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
  const totalPaid = invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
  const totalPending = invoices?.filter((inv) => inv.status === "pending").reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Facturacion"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <BillingDashboard
          invoices={invoices || []}
          movements={movements || []}
          isDentist={isDentist}
          organizationId={org.id}
          stats={{
            totalInvoiced,
            totalPaid,
            totalPending,
          }}
        />
      </div>
    </div>
  );
}
