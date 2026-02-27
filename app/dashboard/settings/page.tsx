import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getUserOrg } from "@/lib/get-user-org";

export default async function SettingsPage() {
  // getUserOrg() shares React.cache() with layout — saves one auth round-trip.
  // We still need the role field, so we run a focused query just for that.
  const { user, org } = await getUserOrg();
  const supabase = await createClient();

  const { data: membershipData } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", org.id)
    .single();

  const role = membershipData?.role ?? "member";

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
          role={role}
        />
      </div>
    </div>
  );
}
