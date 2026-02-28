import { getUserOrg } from "@/lib/get-user-org";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SupportWidget } from "@/components/support/support-widget";
import { WhatsAppButton } from "@/components/support/whatsapp-button";
import { PageTransition } from "@/components/dashboard/page-transition";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getUserOrg() redirects to /auth/login if !user and /onboarding if !org.
  // React.cache() deduplicates this call when layout and page both invoke it.
  const { org, isCollaborator, permissions } = await getUserOrg();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        orgType={org.type as "dentist" | "lab"}
        orgName={org.name}
        isCollaborator={isCollaborator}
        permissions={permissions}
      />
      {/* pt-14 reserves space for the mobile sticky top bar (h-14). Removed on lg+ where the bar doesn't exist. */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 lg:ml-[80px]">
        <PageTransition>{children}</PageTransition>
      </main>
      <SupportWidget />
      <WhatsAppButton />
    </div>
  );
}
