import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import {
  isCollaboratorRole,
  hasPermission,
  permissionDeniedMessage,
} from "@/lib/permissions";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// [BLOQUE 6] POST /api/inventory/[id]/adjust
// Records a stock movement (in/out/adjust) and updates current_stock.
// movement_type:
//   in     → increases current_stock by quantity (incoming).
//   out    → decreases current_stock by quantity (consumption).
//   adjust → SETS current_stock to `quantity` literally; the movement
//            row stores the delta vs. the previous value as an audit trail.

const AdjustInput = z.object({
  movement_type: z.enum(["in", "out", "adjust"]),
  quantity: z.number().min(0),
  reason: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { user, org, role, permissions } = await getUserOrg();
    if (org.type !== "lab") {
      return NextResponse.json({ error: "Solo el laboratorio gestiona stock." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_inventory")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_inventory"), missing_flag: "manage_inventory" },
        { status: 403 },
      );
    }

    const validation = await validateBody(request, AdjustInput);
    if (validation.error) return validation.error;
    const { movement_type, quantity, reason } = validation.data;

    const supabase = await createClient();
    const { data: item, error: readErr } = await supabase
      .from("inventory_items")
      .select("id, lab_org_id, current_stock")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!item) return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });
    if (item.lab_org_id !== org.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const prev = Number(item.current_stock) || 0;
    let next: number;
    let storedQty: number;

    if (movement_type === "in") {
      next = prev + quantity;
      storedQty = quantity;
    } else if (movement_type === "out") {
      if (quantity > prev) {
        return NextResponse.json(
          { error: `No hay suficiente stock. Actual: ${prev}, intento de salida: ${quantity}.` },
          { status: 409 },
        );
      }
      next = prev - quantity;
      storedQty = quantity;
    } else {
      // adjust → set to literal value; movement stores the delta.
      next = quantity;
      storedQty = quantity - prev;
    }

    // Update stock first, then record the movement. If the movement insert
    // fails the stock was already updated — acceptable since current_stock
    // is the source of truth and the movement table is audit log.
    const { error: updErr } = await supabase
      .from("inventory_items")
      .update({ current_stock: next })
      .eq("id", id);
    if (updErr) throw updErr;

    const { error: movErr } = await supabase
      .from("inventory_movements")
      .insert({
        lab_org_id: org.id,
        inventory_item_id: id,
        movement_type,
        quantity: storedQty,
        reason: reason?.trim() || null,
        created_by: user.id,
      });
    if (movErr) {
      logger.error("inventory_movements insert failed (stock already updated):", movErr);
    }

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true, current_stock: next });
  } catch (err: any) {
    logger.error("Error adjusting stock:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
