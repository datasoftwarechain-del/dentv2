import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrdersList } from "@/components/orders/orders-list";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type)")
    .eq("user_id", user.id)
    .single();

  const org = membership?.organization as { id: string; name: string; type: string } | null;
  if (!org) redirect("/dashboard");

  const isDentist = org.type === "dentist";

  // Get orders based on org type
  const { data: orders } = await supabase
    .from("lab_orders")
    .select(`
      *,
      patient:patients(id, first_name, last_name),
      dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
      lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // For dentists, get patients and available labs
  let patients: { id: string; first_name: string; last_name: string }[] = [];
  let labs: { id: string; name: string }[] = [];

  if (isDentist) {
    const { data: patientsData } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("dentist_org_id", org.id)
      .order("first_name");
    patients = patientsData || [];

    const { data: labsData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("type", "lab")
      .order("name");
    labs = labsData || [];
  }

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Pedidos"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <OrdersList
          orders={orders || []}
          isDentist={isDentist}
          organizationId={org.id}
          patients={patients}
          labs={labs}
        />
      </div>
    </div>
  );
}
