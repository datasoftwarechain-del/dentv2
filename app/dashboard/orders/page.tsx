import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrdersList } from "@/components/orders/orders-list";
import { getUserOrg } from "@/lib/get-user-org";

export default async function OrdersPage() {
  const { user, org } = await getUserOrg();
  const supabase = await createClient();

  const isDentist = org.type === "dentist";

  // Get orders based on org type — limit prevents unbounded result sets
  const { data: orders } = await supabase
    .from("lab_orders")
    .select(`
      *,
      items:lab_order_items(work_type, catalog_item:price_catalog(name)),
      patient:patients(id, first_name, last_name),
      dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
      lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
    `)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // For dentists, get patients and available labs
  let patients: { id: string; first_name: string; last_name: string }[] = [];
  let labs: { id: string; name: string }[] = [];
  let defaultLabId: string | null = null;

  if (isDentist) {
    type LabOrg = { id: string; name: string };
    type LabRelation = { lab_org: LabOrg | LabOrg[] | null };

    // Both queries are independent — run in parallel
    const [{ data: patientsData }, { data: labRelationsRaw }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("dentist_org_id", org.id)
        .order("first_name"),
      supabase
        .from("lab_dentist_relations")
        .select("lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)")
        .eq("dentist_org_id", org.id)
        .eq("status", "active"),
    ]);

    patients = patientsData || [];
    const labRelations = (labRelationsRaw || []) as LabRelation[];
    labs = labRelations
      .flatMap((rel) => {
        const lab = rel.lab_org;
        if (!lab) return [];
        return Array.isArray(lab) ? lab : [lab];
      })
      .filter((lab): lab is LabOrg => Boolean(lab?.id && lab?.name));
    labs.sort((a, b) => a.name.localeCompare(b.name));

    // If no lab relations found, show Digital Dent as default (platform's main lab)
    if (labs.length === 0) {
      const { data: allLabs } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("type", "lab")
        .eq("is_system_account", true)
        .order("name");
      const allLabsData = (allLabs || []) as LabOrg[];
      // Prefer labs named "Digital Dent"; fall back to all if none found
      const digitalDentLabs = allLabsData.filter(l =>
        l.name.trim().toLowerCase().includes("digital dent")
      );
      labs = digitalDentLabs.length > 0 ? digitalDentLabs : allLabsData;
    }

    // Auto-select: if only 1 lab, pre-select it; otherwise prefer lab named "Digital Dent"
    if (labs.length === 1) {
      defaultLabId = labs[0].id;
    } else if (labs.length > 1) {
      const preferred = labs.find(l => l.name.trim().toLowerCase().includes("digital dent"));
      defaultLabId = preferred?.id || labs[0].id;
    }
  } else {
    // Logic for Laboratory Users
    // 1. Get connected Dentists (Clinics)
    type DentistOrg = { id: string; name: string };
    type DentistRelation = { dentist_org: DentistOrg | DentistOrg[] | null };

    // Note: We use the same 'labs' variable to store target organizations (clinics) to avoid prop drilling changes for now,
    // though renaming it to 'targetOrgs' in the future would be better.
    const { data: dentistRelationsRaw } = await supabase
      .from("lab_dentist_relations")
      .select("dentist_org:organizations!lab_dentist_relations_dentist_org_id_fkey(id, name)")
      .eq("lab_org_id", org.id)
      .eq("status", "active");

    const dentistRelations = (dentistRelationsRaw || []) as DentistRelation[];
    labs = dentistRelations
      .flatMap((rel) => {
        const dentist = rel.dentist_org;
        if (!dentist) return [];
        return Array.isArray(dentist) ? dentist : [dentist];
      })
      .filter((dentist): dentist is DentistOrg => Boolean(dentist?.id && dentist?.name));
    labs.sort((a, b) => a.name.localeCompare(b.name));

    // 2. Get Patients
    // Ideally we should filter patients by the selected dentist in the UI, 
    // but for the initial load we get patients from all connected clinics.
    if (labs.length > 0) {
      const connectedDentistIds = labs.map(l => l.id);
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .in("dentist_org_id", connectedDentistIds)
        .order("first_name");
      patients = patientsData || [];
    }
  }

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Órdenes"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 px-4 py-4 sm:p-6">
        <OrdersList
          orders={orders || []}
          isDentist={isDentist}
          organizationId={org.id}
          patients={patients}
          labs={labs}
          defaultLabId={defaultLabId}
        />
      </div>
    </div>
  );
}
