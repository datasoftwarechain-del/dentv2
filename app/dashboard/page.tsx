import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrg } from "@/lib/get-user-org";
import { canViewPrices } from "@/lib/permissions";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { redirect } from "next/navigation";
import { LabDashboard } from "@/components/dashboard/lab-dashboard";
import { DentistDashboard } from "@/components/dashboard/dentist-dashboard";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";

export default async function DashboardPage() {
  // getUserOrg() is memoized via React.cache() — shares the result with
  // layout.tsx which calls it in the same server request, so no extra roundtrip.
  const { user, org, permissions } = await getUserOrg();
  const showPrices = canViewPrices(permissions);
  const supabase = await createClient();

  const isPreview = org.type === "dentist_preview";
  const isDentist = org.type === "dentist" || isPreview;
  const isLab = org.type === "lab";

  // Para orgs preview, resolver el ID real de la clínica desde client_invitations
  let effectiveDentistOrgId = org.id;
  // Admin client bypasses RLS — used for both invitation lookup and data queries for preview users
  const db = isPreview ? createAdminClient() : supabase;

  if (isPreview) {
    const { data: invitation } = await db
      .from("client_invitations")
      .select("dentist_org_id")
      .eq("preview_org_id", org.id)
      .eq("status", "active")
      .single();
    if (!invitation) redirect("/auth/login");
    effectiveDentistOrgId = invitation.dentist_org_id;
  }

  // Laboratory dashboard
  if (isLab) {
    // Compute date ranges before Promise.all (no await needed)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // All 5 queries run in parallel — eliminates sequential waterfall
    const [
      { data: dentistOrgs },
      { data: patients },
      { data: allOrders },
      { data: todayOrders },
      { data: tomorrowOrders },
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name")
        .eq("type", "dentist")
        .order("name"),
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .order("last_name"),
      supabase
        .from("lab_orders")
        .select(`
          id, order_number, status, created_at, due_date,
          patient:patients(id, first_name, last_name),
          dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
          items:lab_order_items(work_type, catalog_item:price_catalog(name))
        `)
        .eq("lab_org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("lab_orders")
        .select(`
          id, order_number, status, due_date,
          patient:patients(id, first_name, last_name),
          dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
          lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
        `)
        .eq("lab_org_id", org.id)
        .not("due_date", "is", null)
        .gte("due_date", today.toISOString())
        .lte("due_date", todayEnd.toISOString())
        .order("due_date", { ascending: true }),
      supabase
        .from("lab_orders")
        .select(`
          id, order_number, status, due_date,
          patient:patients(id, first_name, last_name),
          dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
          lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
        `)
        .eq("lab_org_id", org.id)
        .not("due_date", "is", null)
        .gte("due_date", tomorrow.toISOString())
        .lte("due_date", tomorrowEnd.toISOString())
        .order("due_date", { ascending: true }),
    ]);

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
        <LabDashboard
          orgId={org.id}
          orgName={org.name}
          orders={(allOrders as any) || []}
          todayOrders={(todayOrders as any) || []}
          tomorrowOrders={(tomorrowOrders as any) || []}
          patients={patients || []}
          dentistOrgs={dentistOrgs || []}
          showPrices={showPrices}
        />
      </div>
    );
  }

  // ── Dentist Dashboard Data ────────────────────────────────────────────

  // Compute date ranges first (no await)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // All 6 queries run in parallel — eliminates sequential waterfall
  type LabOrg = { id: string; name: string };
  type LabRelation = { lab_org: LabOrg | LabOrg[] | null };

  const [
    { data: patientsData },
    { data: appointments },
    { data: orders },
    { data: labRelationsRaw },
    { data: todayOrders },
    { data: tomorrowOrders },
  ] = await Promise.all([
    db
      .from("patients")
      .select("id, first_name, last_name, created_at")
      .eq("dentist_org_id", effectiveDentistOrgId)
      .order("created_at", { ascending: false }),
    isPreview
      ? Promise.resolve({ data: [] })
      : supabase
          .from("appointments")
          .select(`
            id,
            scheduled_at,
            notes,
            status,
            patient:patients(id, first_name, last_name, created_at)
          `)
          .eq("dentist_org_id", effectiveDentistOrgId)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true }),
    db
      .from("lab_orders")
      .select(`
        id,
        order_number,
        status,
        created_at,
        due_date,
        patient:patients(id, first_name, last_name),
        lab_org:organizations!lab_orders_lab_org_id_fkey(id, name),
        items:lab_order_items(work_type, arancel_type, catalog_item:price_catalog(name))
      `)
      .eq("dentist_org_id", effectiveDentistOrgId)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("lab_dentist_relations")
      .select("lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)")
      .eq("dentist_org_id", effectiveDentistOrgId)
      .eq("status", "active"),
    db
      .from("lab_orders")
      .select(`
        id,
        order_number,
        status,
        due_date,
        patient:patients(id, first_name, last_name),
        dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
        lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
      `)
      .eq("dentist_org_id", effectiveDentistOrgId)
      .not("due_date", "is", null)
      .gte("due_date", today.toISOString())
      .lte("due_date", todayEnd.toISOString())
      .order("due_date", { ascending: true }),
    db
      .from("lab_orders")
      .select(`
        id,
        order_number,
        status,
        due_date,
        patient:patients(id, first_name, last_name),
        dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
        lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
      `)
      .eq("dentist_org_id", effectiveDentistOrgId)
      .not("due_date", "is", null)
      .gte("due_date", tomorrow.toISOString())
      .lte("due_date", tomorrowEnd.toISOString())
      .order("due_date", { ascending: true }),
  ]);

  const patients = patientsData || [];
  const labRelations = (labRelationsRaw || []) as LabRelation[];
  const labs = labRelations
    .flatMap((rel) => {
      const lab = rel.lab_org;
      if (!lab) return [];
      return Array.isArray(lab) ? lab : [lab];
    })
    .filter((lab): lab is LabOrg => Boolean(lab?.id && lab?.name));
  labs.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Dashboard"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <DentistDashboard
        orgId={effectiveDentistOrgId}
        orgName={org.name}
        patients={patients}
        appointments={appointments || []}
        orders={(orders as any) || []}
        todayOrders={(todayOrders as any) || []}
        tomorrowOrders={(tomorrowOrders as any) || []}
        labs={labs}
        isReadOnly={isPreview}
        showPrices={showPrices}
      />
    </div>
  );
}
