import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

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

  // Get user's organization
  const { data: membership } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type)")
    .eq("user_id", user.id)
    .single();

  // If no organization, redirect to onboarding
  const org = membership?.organization as { id: string; name: string; type: string } | null;

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
    </div>
  );
}
