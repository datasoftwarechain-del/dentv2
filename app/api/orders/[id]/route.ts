import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { createClient } from "@/lib/supabase/server";
import { isCollaboratorRole, hasPermission, permissionDeniedMessage } from "@/lib/permissions";
import { validateBody } from "@/lib/api-validation";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();

    // [BLOQUE 1.5] Lateral security fix: previously this checked `create_orders`
    // — which conflated create with destroy. Now requires explicit `delete_orders`.
    // delete_orders is NOT auto-granted to existing collaborators; admins must
    // assign it manually after deploy.
    if (isCollaboratorRole(role) && !hasPermission(permissions, "delete_orders")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("delete_orders"), missing_flag: "delete_orders" },
        { status: 403 },
      );
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

// ─── PATCH ─────────────────────────────────────────────────────────────────────
// [BLOQUE 2] Edit order endpoint. Replaces the previous client-side direct
// Supabase calls in edit-order-form.tsx. Authorization: requires edit_orders
// for collaborators (admins always). Accepts a partial diff of order-level
// fields plus item operations (deleted/updated/new).

const ExtraSchema = z.object({
  name: z.string().max(120),
  price: z.number().min(0),
  qty: z.number().int().positive().optional(),
});

const UpdateItemSchema = z.object({
  id: z.string().uuid(),
  work_type: z.string().nullable().optional(),
  tooth_positions: z.array(z.string()).nullable().optional(),
  shade: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  selected_extras: z.array(ExtraSchema).optional(),
  catalog_item_id: z.string().uuid().nullable().optional(),
});

const NewItemSchema = z.object({
  catalog_item_id: z.string().uuid().nullable().optional(),
  work_type: z.string().nullable().optional(),
  tooth_positions: z.array(z.string()).nullable().optional(),
  shade: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0).nullable().optional(),
  selected_extras: z.array(ExtraSchema).optional(),
});

const PatchOrderSchema = z.object({
  patient_id: z.string().uuid().nullable().optional(),
  status: z.enum(["received", "in_production", "ready", "delivered", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z
    .object({
      deleted: z.array(z.string().uuid()).optional(),
      updated: z.array(UpdateItemSchema).optional(),
      new: z.array(NewItemSchema).optional(),
    })
    .optional(),
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

    // [BLOQUE 2] Defense-in-depth: editing requires edit_orders for collaborators.
    if (isCollaboratorRole(role) && !hasPermission(permissions, "edit_orders")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("edit_orders"), missing_flag: "edit_orders" },
        { status: 403 },
      );
    }

    const validation = await validateBody(request, PatchOrderSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const supabase = await createClient();

    // Ownership check
    const { data: existingOrder, error: fetchErr } = await supabase
      .from("lab_orders")
      .select("id, dentist_org_id, lab_org_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existingOrder) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const isDentist = org.type === "dentist";
    const belongsToOrg = isDentist
      ? existingOrder.dentist_org_id === org.id
      : existingOrder.lab_org_id === org.id;

    if (!belongsToOrg) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 1) Order-level fields
    const orderUpdates: Record<string, unknown> = {};
    if (body.patient_id !== undefined) orderUpdates.patient_id = body.patient_id;
    if (body.status !== undefined)     orderUpdates.status     = body.status;
    if (body.priority !== undefined)   orderUpdates.priority   = body.priority;
    if (body.due_date !== undefined)   orderUpdates.due_date   = body.due_date;
    if (body.notes !== undefined)      orderUpdates.notes      = body.notes;

    if (Object.keys(orderUpdates).length > 0) {
      orderUpdates.updated_at = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("lab_orders")
        .update(orderUpdates)
        .eq("id", id);
      if (updErr) throw updErr;
    }

    const items = body.items ?? {};

    // 2) Delete removed items (verify ownership: must belong to this order)
    if (items.deleted && items.deleted.length > 0) {
      const { error: delErr } = await supabase
        .from("lab_order_items")
        .delete()
        .in("id", items.deleted)
        .eq("order_id", id);
      if (delErr) throw delErr;
    }

    // 3) Update existing items
    if (items.updated && items.updated.length > 0) {
      for (const item of items.updated) {
        const updatePayload: Record<string, unknown> = {};
        if (item.work_type !== undefined)        updatePayload.work_type        = item.work_type;
        if (item.tooth_positions !== undefined)  updatePayload.tooth_positions  = item.tooth_positions;
        if (item.shade !== undefined)            updatePayload.shade            = item.shade;
        if (item.quantity !== undefined)         updatePayload.quantity         = item.quantity;
        if (item.selected_extras !== undefined)  updatePayload.selected_extras  = item.selected_extras;
        if (item.catalog_item_id !== undefined)  updatePayload.catalog_item_id  = item.catalog_item_id;

        if (Object.keys(updatePayload).length === 0) continue;

        const { error: updItemErr } = await supabase
          .from("lab_order_items")
          .update(updatePayload)
          .eq("id", item.id)
          .eq("order_id", id); // ownership guard
        if (updItemErr) throw updItemErr;
      }
    }

    // 4) Insert new items
    if (items.new && items.new.length > 0) {
      const rows = items.new.map((it) => ({
        order_id: id,
        catalog_item_id: it.catalog_item_id ?? null,
        work_type: it.work_type ?? null,
        tooth_positions: it.tooth_positions ?? null,
        shade: it.shade ?? null,
        quantity: it.quantity,
        unit_price: it.unit_price ?? null,
        selected_extras: it.selected_extras ?? [],
      }));
      const { error: insErr } = await supabase
        .from("lab_order_items")
        .insert(rows);
      if (insErr) throw insErr;
    }

    revalidatePath(`/dashboard/orders/${id}`);
    revalidatePath("/dashboard/orders");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
