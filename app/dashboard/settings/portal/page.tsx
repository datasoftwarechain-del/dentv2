import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PortalSection } from "@/components/settings/portal-section";

export default async function PortalPage() {
  const { user, org, isCollaborator } = await getUserOrg();

  // Solo admins de laboratorio pueden acceder
  if (org.type !== "lab" || isCollaborator) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Fetch connected dentist orgs via lab_dentist_relations
  const { data: relations } = await supabase
    .from("lab_dentist_relations")
    .select("dentist_org_id, organization:dentist_org_id(id, name)")
    .eq("lab_org_id", org.id);

  const dentistOptions = (relations ?? []).map((r: any) => {
    const orgData = Array.isArray(r.organization) ? r.organization[0] : r.organization;
    return {
      value: r.dentist_org_id as string,
      label: (orgData?.name ?? r.dentist_org_id) as string,
    };
  });

  // Fetch existing invitations for this lab
  const { data: rawInvitations } = await supabase
    .from("client_invitations")
    .select(`
      id,
      invited_email,
      display_name,
      status,
      converted_at,
      created_at,
      updated_at,
      dentist_org:dentist_org_id(id, name)
    `)
    .eq("lab_org_id", org.id)
    .order("created_at", { ascending: false });

  // Normalize dentist_org — Supabase returns it as an array for foreign key joins
  const invitations = (rawInvitations ?? []).map((inv: any) => ({
    ...inv,
    dentist_org: Array.isArray(inv.dentist_org)
      ? (inv.dentist_org[0] ?? null)
      : (inv.dentist_org ?? null),
  }));

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Portal de Clínicas"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <PortalSection
          dentistOptions={dentistOptions}
          invitations={invitations}
          labOrgId={org.id}
        />
      </div>
    </div>
  );
}
