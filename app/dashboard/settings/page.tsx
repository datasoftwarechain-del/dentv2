import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getUserOrg } from "@/lib/get-user-org";

export default async function SettingsPage() {
  // getUserOrg() returns isCollaborator — more reliable than checking the role string value
  // since the org_member_role enum may differ across projects (owner vs admin).
  const { user, org, isCollaborator } = await getUserOrg();

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Configuracion"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <SettingsForm
          user={{
            id: user.id,
            email: user.email || "",
            firstName: user.user_metadata?.first_name || "",
            lastName: user.user_metadata?.last_name || "",
          }}
          organization={org}
          role={isCollaborator ? "collaborator" : "admin"}
        />
      </div>
    </div>
  );
}
