import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PatientsList } from "@/components/patients/patients-list";

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type)")
    .eq("user_id", user.id)
    .single();

  const orgData = membership?.organization as
    | { id: string; name: string; type: string }
    | { id: string; name: string; type: string }[]
    | null
    | undefined;
  const org = Array.isArray(orgData) ? orgData[0] : orgData ?? null;
  if (!org || org.type !== "dentist") redirect("/dashboard");

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .eq("dentist_org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Pacientes"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <PatientsList patients={patients || []} organizationId={org.id} />
      </div>
    </div>
  );
}
