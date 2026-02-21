import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SupportWidget } from "@/components/support/support-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get user's organizations (only system accounts, not client records)
  // Changed from .single() to handle users with multiple orgs
  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type, is_system_account)")
    .eq("user_id", user.id);

  // Filter for system accounts only and get the first one
  const orgs = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any) => o && o.is_system_account !== false);

  const org = orgs[0] || null;

  // If no valid organization, redirect to onboarding
  if (!org) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        orgType={org.type as "dentist" | "lab"}
        orgName={org.name}
      />
      <main className="flex-1 overflow-auto lg:ml-0">{children}</main>
      <SupportWidget />
    </div>
  );
}
