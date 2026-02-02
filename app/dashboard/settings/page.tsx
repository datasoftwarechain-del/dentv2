import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization:org_id(*), role")
    .eq("user_id", user.id)
    .single();

  const org = membership?.organization as {
    id: string;
    name: string;
    type: string;
    phone: string | null;
    address: string | null;
  } | null;

  if (!org) redirect("/dashboard");

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
          role={membership?.role || "member"}
        />
      </div>
    </div>
  );
}
