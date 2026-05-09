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
    const {
      dentistOrgId, patientName, workType, total, dueDate, notes,
      // [031_invoice_discounts] Inputs opcionales del descuento ya calculado
      // por el form. Si vienen, persistimos los 3; si no, defaults limpios.
      subtotal, taxRate, taxAmount, discountType, discountValue, discountAmount,
    } = body;

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

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const parsedTotal    = round2(Number(total));
    const parsedSubtotal = round2(Number(subtotal ?? total));
    const parsedTaxRate  = taxRate != null ? Number(taxRate) : 0;
    const parsedTaxAmt   = round2(Number(taxAmount ?? 0));

    // Validación defensiva del descuento: si viene type, value/amount son números.
    const hasDiscount = discountType === "percent" || discountType === "amount";
    const parsedDiscountValue  = hasDiscount && discountValue != null ? Number(discountValue) : null;
    const parsedDiscountAmount = hasDiscount ? round2(Number(discountAmount ?? 0)) : 0;
    if (hasDiscount && (parsedDiscountAmount < 0 || (parsedDiscountValue ?? 0) < 0)) {
      return NextResponse.json({ error: "Descuento inválido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        lab_org_id: org.id,
        dentist_org_id: dentistOrgId,
        patient_name: patientName?.trim() || null,
        work_type: workType || null,
        subtotal: parsedSubtotal,
        total: parsedTotal,
        tax_rate: parsedTaxRate,
        tax_amount: parsedTaxAmt,
        discount_type: hasDiscount ? discountType : null,
        discount_value: hasDiscount ? parsedDiscountValue : null,
        discount_amount: parsedDiscountAmount,
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
