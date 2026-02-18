import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

async function getOrgForUser(supabase: any, userId: string) {
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

  return orgs[0] || null;
}

// GET: list patient invoices for the org
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrgForUser(supabase, user.id);
    if (!org || org.type !== "dentist")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("patient_invoices")
      .select("*, patient:patients(id, first_name, last_name)")
      .eq("dentist_org_id", org.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create a new patient invoice
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrgForUser(supabase, user.id);
    if (!org || org.type !== "dentist")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { patientId, patientName, description, items, subtotal, total, dueDate, notes } = body;

    if (!description || total === undefined)
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });

    const { data, error } = await supabase
      .from("patient_invoices")
      .insert({
        dentist_org_id: org.id,
        patient_id: patientId || null,
        patient_name: patientName || null,
        description,
        items: items || [],
        subtotal: subtotal || total,
        total,
        due_date: dueDate || null,
        notes: notes || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: update status or details
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrgForUser(supabase, user.id);
    if (!org || org.type !== "dentist")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, status, total, description, dueDate, notes } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "paid") updateData.paid_at = new Date().toISOString();
    }
    if (total !== undefined) updateData.total = total;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.due_date = dueDate;
    if (notes !== undefined) updateData.notes = notes;

    const { error } = await supabase
      .from("patient_invoices")
      .update(updateData)
      .eq("id", id)
      .eq("dentist_org_id", org.id);

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: remove a patient invoice
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrgForUser(supabase, user.id);
    if (!org || org.type !== "dentist")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase
      .from("patient_invoices")
      .delete()
      .eq("id", id)
      .eq("dentist_org_id", org.id);

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
