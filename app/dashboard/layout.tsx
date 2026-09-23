import { getUserOrg } from "@/lib/get-user-org";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SupportWidget } from "@/components/support/support-widget";
import { WhatsAppButton } from "@/components/support/whatsapp-button";
import { PageTransition } from "@/components/dashboard/page-transition";
import { countPendingDesignOrders } from "@/lib/design/pending";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getUserOrg() redirects to /auth/login if !user and /onboarding if !org.
  // React.cache() deduplicates this call when layout and page both invoke it.
  const { org, isCollaborator, permissions, availableOrgs } = await getUserOrg();

  // [035_design_studio] Cuánto espera una acción tuya en el módulo de
  // diseño. Es una sola query con count/head y devuelve 0 ante cualquier
  // error, así que no puede tumbar el layout de todo el dashboard.
  const pendingDesign = await countPendingDesignOrders(org.id, org.type);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        orgType={org.type}
        orgName={org.name}
        isCollaborator={isCollaborator}
        permissions={permissions}
        badges={{ "/dashboard/design": pendingDesign }}
        orgId={org.id}
        availableOrgs={availableOrgs}
      />
      {/* pt-14 reserves space for the mobile sticky top bar (h-14). Removed on lg+ where the bar doesn't exist. */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 lg:ml-[80px]">
        <div className="[zoom:0.8] lg:[zoom:1]">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <SupportWidget />
      <WhatsAppButton />
    </div>
  );
}
