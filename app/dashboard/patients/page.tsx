import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PatientsList } from "@/components/patients/patients-list";
import { PreviewGate } from "@/components/dashboard/preview-gate";
import { getUserOrg } from "@/lib/get-user-org";
import { Users } from "lucide-react";

export default async function PatientsPage() {
  // No-arg call shares React.cache() with layout — avoids duplicate auth round-trip
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (org.type !== "dentist" && org.type !== "dentist_preview") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_patients) redirect("/dashboard");

  if (org.type === "dentist_preview") {
    return (
      <PreviewGate
        featureName="Pacientes"
        description="Visualizá y gestioná el historial completo de tus pacientes. Activá tu cuenta para acceder a esta función."
        icon={Users}
      />
    );
  }

  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .eq("dentist_org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(500); // Prevent unbounded result sets from degrading performance

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
      <div className="flex-1 px-4 py-4 sm:p-6">
        <PatientsList patients={patients || []} organizationId={org.id} />
      </div>
    </div>
  );
}
