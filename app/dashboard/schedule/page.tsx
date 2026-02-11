import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WeeklySchedule } from "@/components/schedule/weekly-schedule";

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Get user's organizations (handle multiple orgs like layout does)
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
  if (!org) redirect("/dashboard");

  const isDentist = org.type === "dentist";

  // Get current week start (Monday) and end (Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Fetch orders with due dates in the current week
  const { data: orders } = await supabase
    .from("lab_orders")
    .select(`
      *,
      items:lab_order_items(work_type, tooth_positions, shade),
      patient:patients(id, first_name, last_name),
      dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
      lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .not("due_date", "is", null)
    .gte("due_date", weekStart.toISOString())
    .lte("due_date", weekEnd.toISOString())
    .order("due_date", { ascending: true });

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Agenda Semanal"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <WeeklySchedule
          orders={orders || []}
          isDentist={isDentist}
          weekStart={weekStart}
        />
      </div>
    </div>
  );
}
