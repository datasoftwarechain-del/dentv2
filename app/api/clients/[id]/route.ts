import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// PATCH: update contact info for a client org that belongs to the lab
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: clientOrgId } = await params;

    // Verify the caller is a lab and has orders with this dentist org
    const { data: memberships } = await supabase
      .from("org_members")
      .select("organization:org_id(id, type, is_system_account)")
      .eq("user_id", user.id);

    const orgs = (memberships || [])
      .map((m: any) => {
        const orgData = m.organization;
        return Array.isArray(orgData) ? orgData[0] : orgData;
      })
      .filter((o: any) => o && o.is_system_account !== false);

    const org = orgs[0] || null;
    if (!org || org.type !== "lab") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify this dentist org actually has orders with the lab
    const { data: orderCheck } = await supabase
      .from("lab_orders")
      .select("id")
      .eq("lab_org_id", org.id)
      .eq("dentist_org_id", clientOrgId)
      .limit(1)
      .maybeSingle();

    if (!orderCheck) {
      return NextResponse.json({ error: "Client not associated with this lab" }, { status: 403 });
    }

    const body = await request.json();
    const { phone, email, address, city, tax_id, notes } = body;

    // Update the organization fields
    const updateData: Record<string, any> = {};
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email || null;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (tax_id !== undefined) updateData.tax_id = tax_id || null;
    // notes stored in settings JSONB
    if (notes !== undefined) {
      updateData.settings = { notes };
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", clientOrgId);

    if (error) throw error;

    revalidatePath(`/dashboard/clients/${clientOrgId}`);
    revalidatePath("/dashboard/clients");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
