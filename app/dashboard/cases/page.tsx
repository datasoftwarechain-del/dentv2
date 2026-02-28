import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CasesView } from "@/components/cases/cases-view";
import { getUserOrg } from "@/lib/get-user-org";

export default async function CasesPage() {
  // Shares React.cache() with layout — no extra auth round-trip
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_cases) redirect("/dashboard");

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
