import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AppointmentsList } from "@/components/appointments/appointments-list";
import { getUserOrg } from "@/lib/get-user-org";

export default async function AppointmentsPage() {
  // Call getUserOrg() with no args so React.cache() shares the result with
  // the dashboard layout — eliminates one extra getUser() + org_members round-trip.
  const { user, org } = await getUserOrg();
  if (org.type !== "dentist") redirect("/dashboard");

  const supabase = await createClient();

  // Both queries are independent — run in parallel
  const [{ data: appointments }, { data: patients }] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        *,
        patient:patients(id, first_name, last_name)
      `)
      .eq("dentist_org_id", org.id)
      .order("scheduled_at", { ascending: true }),

    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("dentist_org_id", org.id)
      .order("first_name"),
  ]);

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
      <div className="flex-1 px-4 py-4 sm:p-6">
        <AppointmentsList
          appointments={appointments || []}
          patients={patients || []}
          organizationId={org.id}
        />
      </div>
    </div>
  );
}
