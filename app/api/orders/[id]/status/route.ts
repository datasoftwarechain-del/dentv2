import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { createClient } from "@/lib/supabase/server";
import { isCollaboratorRole, hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const StatusSchema = z.object({
  status: z.enum(["received", "in_progress", "ready", "delivered", "cancelled"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();

    if (isCollaboratorRole(role) && !hasPermission(permissions, "update_order_status")) {
      return NextResponse.json({ error: "Sin permiso para cambiar estado" }, { status: 403 });
    }

    const validation = await validateBody(request, StatusSchema);
    if (validation.error) return validation.error;
    const { status } = validation.data;

    const supabase = await createClient();

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

    const { error } = await supabase
      .from("lab_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
