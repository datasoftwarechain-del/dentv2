import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, dueDate, dueTime } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Get user's org to verify ownership
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
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Verify the order belongs to this org
    const { data: order } = await supabase
      .from("lab_orders")
      .select("id, dentist_org_id, lab_org_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isDentist = org.type === "dentist";
    const belongsToOrg = isDentist
      ? order.dentist_org_id === org.id
      : order.lab_org_id === org.id;

    if (!belongsToOrg) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Build the timestamp
    let dueDateTimestamp: string | null = null;
    if (dueDate) {
      const timeStr = dueTime || "18:00";
      dueDateTimestamp = `${dueDate}T${timeStr}:00`;
    }

    const { error } = await supabase
      .from("lab_orders")
      .update({ due_date: dueDateTimestamp })
      .eq("id", orderId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath("/dashboard/orders");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
