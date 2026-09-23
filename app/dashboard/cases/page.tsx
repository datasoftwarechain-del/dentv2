import { redirect } from "next/navigation";
import { DESIGN_CLIENT_HOME } from "@/lib/design/client-guard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CasesView } from "@/components/cases/cases-view";
import { PreviewGate } from "@/components/dashboard/preview-gate";
import { getUserOrg } from "@/lib/get-user-org";
import { Scan } from "lucide-react";

export default async function CasesPage() {
  // Shares React.cache() with layout — no extra auth round-trip
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  // [037] Un cliente de solo-diseño no contrató el ERP: esta pantalla no
  // es suya. El menú ya no se la muestra; esto frena la URL escrita a mano.
  if (org.type === "design_client") redirect(DESIGN_CLIENT_HOME);

  if (isCollaborator && !permissions?.view_cases) redirect("/dashboard");

  if (org.type === "dentist_preview") {
    return (
      <PreviewGate
        featureName="Casos Digitales"
        description="Adjuntá archivos STL, radiografías y fotos a cada caso clínico. Activá tu cuenta para acceder."
        icon={Scan}
      />
    );
  }

  const isDentist = org.type === "dentist";

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Casos Digitales"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <CasesView
          organizationId={org.id}
          isDentist={isDentist}
        />
      </div>
    </div>
  );
}
