import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrdersList } from "@/components/orders/orders-list";
import { getUserOrg } from "@/lib/get-user-org";

// [Sección 5] Filtros + paginación server-side. Lectura de searchParams para
// que la URL sea bookmarkeable y el listado refresque/comparta sin perder estado.
const PAGE_SIZE = 25;

interface OrdersSearchParams {
  q?: string;            // Número de orden (ilike)
  patient?: string;      // Búsqueda por nombre de paciente (ilike sobre first_name/last_name)
  client?: string;       // ID de la clínica/lab (UUID)
  status?: string;       // Estado de la orden
  date_from?: string;    // YYYY-MM-DD inclusive
  date_to?: string;      // YYYY-MM-DD inclusive
  page?: string;         // 1-indexed
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  const sp = await searchParams;
  const requestedPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const offset = (requestedPage - 1) * PAGE_SIZE;

  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_orders) redirect("/dashboard");

  const isPreview = org.type === "dentist_preview";
  const isDentist = org.type === "dentist" || isPreview;

  const canCreate = isPreview ? false : (!isCollaborator || !!permissions?.create_orders);
  const canUpdateStatus = isPreview ? false : (!isCollaborator || !!permissions?.update_order_status);
  const showPrices = !isCollaborator || !!permissions?.view_prices;

  const supabase = await createClient();

  let effectiveOrgId = org.id;
  const db = isPreview ? createAdminClient() : supabase;

  if (isPreview) {
    const { data: invitation } = await db
      .from("client_invitations")
      .select("dentist_org_id")
      .eq("preview_org_id", org.id)
      .eq("status", "active")
      .single();
    if (!invitation) redirect("/dashboard");
    effectiveOrgId = invitation.dentist_org_id;
  }

  // [Sección 5] Resolver patient_ids cuando hay filtro por paciente.
  // Sub-query separada: encontramos pacientes cuyos first/last name matchean
  // y filtramos `lab_orders.patient_id IN (...)`. Más limpio que un join
  // con !inner + foreignTable, y mantiene paginación correcta.
  let patientIdFilter: string[] | null = null;
  if (sp.patient && sp.patient.trim()) {
    const term = sp.patient.trim();
    const dentistScope = isDentist ? effectiveOrgId : null;
    let patientQ = db.from("patients").select("id");
    if (dentistScope) patientQ = patientQ.eq("dentist_org_id", dentistScope);
    const { data: patientRows } = await patientQ.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
    );
    patientIdFilter = (patientRows || []).map((p: any) => p.id);
    if (patientIdFilter.length === 0) patientIdFilter = ["__none__"]; // fuerza 0 resultados
  }

  // Query principal con count exact para paginación
  let query = db
    .from("lab_orders")
    .select(`
      *,
      items:lab_order_items(work_type, arancel_type, catalog_item:price_catalog(name)),
      patient:patients(id, first_name, last_name),
      dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
      lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
    `, { count: "exact" })
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", effectiveOrgId);

  if (sp.q && sp.q.trim()) {
    query = query.ilike("order_number", `%${sp.q.trim()}%`);
  }
  if (sp.status && sp.status !== "all") {
    query = query.eq("status", sp.status);
  }
  if (sp.client && sp.client.trim()) {
    // Para dentista filtra por lab; para lab filtra por dentista.
    query = query.eq(isDentist ? "lab_org_id" : "dentist_org_id", sp.client.trim());
  }
  if (sp.date_from) {
    query = query.gte("created_at", sp.date_from);
  }
  if (sp.date_to) {
    // Inclusivo hasta fin del día.
    query = query.lte("created_at", sp.date_to + "T23:59:59");
  }
  if (patientIdFilter !== null) {
    query = query.in("patient_id", patientIdFilter);
  }

  const { data: ordersRaw, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // Si la URL pide una page más allá del total (filtro reciente), redirigimos
  // a la última válida para evitar un listado vacío silencioso.
  const currentPage = Math.min(requestedPage, totalPages);

  // For dentists, get patients and available labs (para el dialog de creación
  // y el dropdown de filtro de clientes).
  let patients: { id: string; first_name: string; last_name: string }[] = [];
  let labs: { id: string; name: string }[] = [];
  let defaultLabId: string | null = null;

  if (isDentist) {
    type LabOrg = { id: string; name: string };
    type LabRelation = { lab_org: LabOrg | LabOrg[] | null };

    const [{ data: patientsData }, { data: labRelationsRaw }] = await Promise.all([
      db
        .from("patients")
        .select("id, first_name, last_name")
        .eq("dentist_org_id", effectiveOrgId)
        .order("first_name"),
      db
        .from("lab_dentist_relations")
        .select("lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)")
        .eq("dentist_org_id", effectiveOrgId)
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

    if (labs.length === 0) {
      const { data: allLabs } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("type", "lab")
        .eq("is_system_account", true)
        .order("name");
      const allLabsData = (allLabs || []) as LabOrg[];
      const digitalDentLabs = allLabsData.filter(l =>
        l.name.trim().toLowerCase().includes("digital dent")
      );
      labs = digitalDentLabs.length > 0 ? digitalDentLabs : allLabsData;
    }

    if (labs.length === 1) {
      defaultLabId = labs[0].id;
    } else if (labs.length > 1) {
      const preferred = labs.find(l => l.name.trim().toLowerCase().includes("digital dent"));
      defaultLabId = preferred?.id || labs[0].id;
    }
  } else {
    type DentistOrg = { id: string; name: string };
    type DentistRelation = { dentist_org: DentistOrg | DentistOrg[] | null };

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
          orders={ordersRaw || []}
          isDentist={isDentist}
          organizationId={effectiveOrgId}
          patients={patients}
          labs={labs}
          defaultLabId={defaultLabId}
          canCreate={canCreate}
          canUpdateStatus={canUpdateStatus}
          showPrices={showPrices}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          initialFilters={{
            q: sp.q || "",
            patient: sp.patient || "",
            client: sp.client || "",
            status: sp.status || "",
            dateFrom: sp.date_from || "",
            dateTo: sp.date_to || "",
          }}
        />
      </div>
    </div>
  );
}
