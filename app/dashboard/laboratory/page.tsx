import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog"; // Absolute path to be safe, or relative
import { TotalOrdersCard } from "./components/TotalOrdersCard";
import { ActiveClientCard } from "./components/ActiveClientCard";
import { SummaryReportCard } from "./components/SummaryReportCard";
import { WorksInProgressList } from "./components/WorksInProgressList";

export default async function LaboratoryDashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    // Get organization
    const { data: membership } = await supabase
        .from("org_members")
        .select("organization:org_id(id, name, type)")
        .eq("user_id", user.id)
        .single();

    const orgData = membership?.organization as
        | { id: string; name: string; type: string }
        | { id: string; name: string; type: string }[]
        | null
        | undefined;
    const org = Array.isArray(orgData) ? orgData[0] : orgData ?? null;

    if (!org) redirect("/dashboard");

    // Only allow lab organizations
    if (org.type !== "lab") {
        redirect("/dashboard");
    }

    // Fetch data for manual order entry
    const { data: dentistOrgs } = await supabase
        .from("organizations")
        .select("id, name")
        // .eq("type", "dentist") // Assuming 'dentist' type exists, strictly filtering might hide legacy data, but usually safe.
        // Actually, let's just fetch all 'dentist' orgs.
        .eq("type", "dentist")
        .order("name");

    const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .order("last_name");


    return (
        <div className="flex flex-col">
            <DashboardHeader
                title="Dashboard Laboratorio"
                user={{
                    email: user.email || "",
                    firstName: user.user_metadata?.first_name,
                    lastName: user.user_metadata?.last_name,
                }}
            />

            <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-end mb-6">
                    <CreateOrderDialog
                        organizationId={org.id}
                        mode="lab"
                        patients={patients || []}
                        labs={dentistOrgs || []}
                    />
                </div>

                {/* Stats Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <TotalOrdersCard orgId={org.id} />
                    <ActiveClientCard orgId={org.id} />
                    <div className="sm:col-span-2">
                        <SummaryReportCard orgId={org.id} />
                    </div>
                </div>

                {/* Works in Progress */}
                <WorksInProgressList orgId={org.id} />
            </div>
        </div>
    );
}
