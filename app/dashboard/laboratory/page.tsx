import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { TotalOrdersCard } from "./components/TotalOrdersCard";
import { ActiveClientCard } from "./components/ActiveClientCard";
import { SummaryReportCard } from "./components/SummaryReportCard";
import { WorksInProgressList } from "./components/WorksInProgressList";
import { getUserOrg } from "@/lib/get-user-org";

export default async function LaboratoryDashboardPage() {
    // Shares React.cache() with layout — no extra auth round-trip
    const { user, org } = await getUserOrg();
    if (org.type !== "lab") redirect("/dashboard");

    const supabase = await createClient();

    // Both queries are independent — run in parallel
    // dentistOrgs filtered to active relations only (lab_dentist_relations.status = 'active')
    const [{ data: activeRelations }, { data: patients }] = await Promise.all([
        supabase
            .from("lab_dentist_relations")
            .select("dentist_org:dentist_org_id(id, name)")
            .eq("lab_org_id", org.id)
            .eq("status", "active"),

        supabase
            .from("patients")
            .select("id, first_name, last_name")
            .order("last_name"),
    ]);

    const dentistOrgs = (activeRelations || [])
        .map((r: any) => {
            const o = Array.isArray(r.dentist_org) ? r.dentist_org[0] : r.dentist_org;
            return o as { id: string; name: string } | null;
        })
        .filter((o): o is { id: string; name: string } => o !== null)
        .sort((a, b) => a.name.localeCompare(b.name));


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
