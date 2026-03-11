import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { createClient } from "@/lib/supabase/server";
import { isCollaboratorRole, hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();

    // Solo admin o colaborador con create_orders puede eliminar
    if (isCollaboratorRole(role) && !hasPermission(permissions, "create_orders")) {
      return NextResponse.json({ error: "Sin permiso para eliminar órdenes" }, { status: 403 });
    }

    const supabase = await createClient();

    // Verificar que la orden pertenece al org
    const { data: order } = await supabase
      .from("lab_orders")
      .select("id, dentist_org_id, lab_org_id")
      .eq("id", id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const isDentist = org.type === "dentist";
    const belongsToOrg = isDentist
      ? order.dentist_org_id === org.id
      : order.lab_org_id === org.id;

    if (!belongsToOrg) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Eliminar items primero (FK constraint)
    await supabase.from("lab_order_items").delete().eq("order_id", id);

    // Eliminar la orden
    const { error } = await supabase.from("lab_orders").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
