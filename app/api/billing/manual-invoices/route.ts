import { createClient } from "@/lib/supabase/server";
import { getOrgForApiRoute } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { validateCSRF } from "@/lib/csrf";
import { localDateInputToISO } from "@/lib/date-utils";

// POST: create a manual invoice (no order required)
export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrgForApiRoute(supabase, user.id);
    if (!org || org.type !== "lab")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
        due_date: localDateInputToISO(dueDate),
        notes: notes?.trim() || null,
        totals_strict: true,
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
