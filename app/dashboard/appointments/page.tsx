import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AppointmentsList } from "@/components/appointments/appointments-list";

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name, type)")
    .eq("user_id", user.id)
    .single();

  const org = membership?.organization as { id: string; name: string; type: string } | null;
  if (!org || org.type !== "dentist") redirect("/dashboard");

  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:patients(id, first_name, last_name)
    `)
    .eq("organization_id", org.id)
    .order("scheduled_at", { ascending: true });

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("organization_id", org.id)
    .order("first_name");

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Citas"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <AppointmentsList 
          appointments={appointments || []} 
          patients={patients || []}
          organizationId={org.id} 
        />
      </div>
    </div>
  );
}
