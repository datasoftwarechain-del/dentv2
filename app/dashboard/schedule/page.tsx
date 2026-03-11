import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WeeklySchedule } from "@/components/schedule/weekly-schedule";
import { getUserOrg } from "@/lib/get-user-org";

export const dynamic = "force-dynamic";

export default async function SchedulePage(props: any) {
  // Shares React.cache() with layout — no extra auth round-trip
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_schedule) redirect("/dashboard");
  const supabase = await createClient();

  const isPreview = org.type === "dentist_preview";
  const isDentist = org.type === "dentist" || isPreview;

  // Para preview: resolver el org ID real de la clínica y el lab
  let effectiveOrgId = org.id;
  // Admin client bypasses RLS — used for both invitation lookup and data queries for preview users
  const db = isPreview ? createAdminClient() : supabase;

  if (isPreview) {
    const { data: invitation } = await db
      .from("client_invitations")
      .select("dentist_org_id")
      .eq("preview_org_id", org.id)
      .eq("status", "active")
      .single();
    if (!invitation) redirect("/dashboard/billing");
    effectiveOrgId = invitation.dentist_org_id;
  }

  // ── Read week param (supports both sync & async searchParams) ─────────────
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const weekParam: string | undefined = searchParams?.week;

  // ── Calculate weekStart from param or default to current Monday ───────────
  let weekStart: Date;

  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const [y, m, d] = weekParam.split("-").map(Number);
    weekStart = new Date(y, m - 1, d); // local date, no UTC offset
  } else {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // adjust to Monday
    weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Serialize weekStart as YYYY-MM-DD string (safe for RSC → client prop)
  const weekStartStr = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, "0"),
    String(weekStart.getDate()).padStart(2, "0"),
  ].join("-");

  // ── Fetch orders + appointments in parallel ────────────────────────────────
  const [{ data: orders }, { data: appointmentsData }] = await Promise.all([
    db
      .from("lab_orders")
      .select(`
        *,
        items:lab_order_items(work_type, tooth_positions, shade, catalog_item:price_catalog(name)),
        patient:patients(id, first_name, last_name),
        dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
        lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
      `)
      .eq(isDentist ? "dentist_org_id" : "lab_org_id", effectiveOrgId)
      .not("due_date", "is", null)
      .gte("due_date", weekStart.toISOString())
      .lte("due_date", weekEnd.toISOString())
      .order("due_date", { ascending: true }),

    // Always run this query; ignore result for lab users (avoids an if/await waterfall)
    isDentist
      ? db
          .from("appointments")
          .select(`id, scheduled_at, notes, status, patient:patients(id, first_name, last_name)`)
          .eq("dentist_org_id", effectiveOrgId)
          .gte("scheduled_at", weekStart.toISOString())
          .lte("scheduled_at", weekEnd.toISOString())
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const appointments = isDentist ? (appointmentsData ?? []) : [];

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
          appointments={appointments}
          isDentist={isDentist}
          weekStartStr={weekStartStr}
        />
      </div>
    </div>
  );
}
