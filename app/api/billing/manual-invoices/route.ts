import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

async function getLabOrgForUser(supabase: any, userId: string) {
  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization:org_id(id, type, is_system_account)")
    .eq("user_id", userId);

  const orgs = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any) => o && o.is_system_account !== false);

  const org = orgs[0] || null;
  return org?.type === "lab" ? org : null;
}

// POST: create a manual invoice (no order required)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getLabOrgForUser(supabase, user.id);
    if (!org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { dentistOrgId, patientName, workType, total, dueDate, notes } = body;

    if (!dentistOrgId || total === undefined || isNaN(Number(total)) || Number(total) <= 0) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Verify the dentist org is connected to this lab
    const { data: relation } = await supabase
      .from("lab_dentist_relations")
      .select("id")
      .eq("lab_org_id", org.id)
      .eq("dentist_org_id", dentistOrgId)
      .maybeSingle();

    if (!relation) {
      return NextResponse.json({ error: "Clínica no conectada" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        lab_org_id: org.id,
        dentist_org_id: dentistOrgId,
        patient_name: patientName?.trim() || null,
        work_type: workType || null,
        subtotal: Number(total),
        total: Number(total),
        tax_amount: 0,
        status: "pending",
        due_date: dueDate || null,
        notes: notes?.trim() || null,
      })
      .select(`
        *,
        dentist_org:organizations!invoices_dentist_org_id_fkey(id, name),
        lab_org:organizations!invoices_lab_org_id_fkey(id, name)
      `)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
