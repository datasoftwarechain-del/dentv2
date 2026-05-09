import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { createClient } from "@/lib/supabase/server";
import { isCollaboratorRole, hasPermission, permissionDeniedMessage } from "@/lib/permissions";
import { validateBody } from "@/lib/api-validation";
import { getEffectivePricesBatch } from "@/lib/pricing";
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

    // [Sección 4] Bloquear eliminación si existe factura emitida no anulada
    // para esta orden. La factura es contable: borrar la orden con la factura
    // en pie deja un huérfano sin trazabilidad. El usuario tiene que anular o
    // eliminar la factura primero.
    const { data: activeInvoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("order_id", id)
      .is("invoice_voided_at", null)
      .maybeSingle();

    if (invErr) throw invErr;
    if (activeInvoice) {
      return NextResponse.json(
        {
          error: `Esta orden tiene una factura emitida (${activeInvoice.invoice_number}). Eliminala o anulala primero.`,
          invoice_id: activeInvoice.id,
          invoice_number: activeInvoice.invoice_number,
        },
        { status: 409 },
      );
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
      // Server-side autocomplete de unit_price: si el item nuevo viene con
      // catalog_item_id pero sin unit_price (caso del colaborador sin
      // view_prices, cuyo catálogo del cliente fue sanitizado a base_price=0),
      // lo rellenamos con el effective_price del catálogo del lab para este
      // dentista. Así el dato persiste correcto incluso si el caller nunca
      // pudo verlo en pantalla.
      const labOrgId = existingOrder.lab_org_id as string | null;
      const dentistOrgId = existingOrder.dentist_org_id as string | null;
      const needsLookup = items.new.filter(
        (it) => it.catalog_item_id && (it.unit_price === null || it.unit_price === undefined || it.unit_price === 0),
      );
      let priceMap = new Map<string, number>();
      if (needsLookup.length > 0 && labOrgId && dentistOrgId) {
        const { data: catalogRows } = await supabase
          .from("price_catalog")
          .select("id, base_price")
          .in("id", needsLookup.map((it) => it.catalog_item_id as string));
        const baseList = (catalogRows ?? []) as { id: string; base_price: number }[];
        const overrideMap = baseList.length > 0
          ? await getEffectivePricesBatch(supabase, labOrgId, dentistOrgId, baseList)
          : new Map();
        for (const row of baseList) {
          const eff = overrideMap.get(row.id);
          priceMap.set(row.id, eff?.effective ?? row.base_price ?? 0);
        }
      }

      const rows = items.new.map((it) => {
        const filled =
          it.catalog_item_id &&
          (it.unit_price === null || it.unit_price === undefined || it.unit_price === 0)
            ? priceMap.get(it.catalog_item_id) ?? null
            : (it.unit_price ?? null);
        return {
          order_id: id,
          catalog_item_id: it.catalog_item_id ?? null,
          work_type: it.work_type ?? null,
          tooth_positions: it.tooth_positions ?? null,
          shade: it.shade ?? null,
          quantity: it.quantity,
          unit_price: filled,
          selected_extras: it.selected_extras ?? [],
        };
      });
      const { error: insErr } = await supabase
        .from("lab_order_items")
        .insert(rows);
      if (insErr) throw insErr;
    }

    // [BLOQUE 2] Revalidate every page that surfaces work_type or order
    // metadata. Identified via grep work_type in app/dashboard/.
    // Dynamic routes use the layout/page form so all instances refresh.
    revalidatePath(`/dashboard/orders/${id}`);
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard/laboratory");
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/billing/accounts/[clientId]", "page");
    revalidatePath("/dashboard/clients/[id]", "page");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
