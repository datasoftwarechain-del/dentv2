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

// [BLOQUE 6] Inventory item update + delete (lab-only, manage_inventory).

const InventoryUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  unit: z.string().max(50).optional(),
  min_stock: z.number().min(0).optional(),
  unit_cost: z.number().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function ensureOwnership(supabase: any, id: string, labOrgId: string) {
  const { data: row, error } = await supabase
    .from("inventory_items")
    .select("id, lab_org_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false as const, status: 404 as const, msg: "Material no encontrado" };
  if (row.lab_org_id !== labOrgId) return { ok: false as const, status: 403 as const, msg: "No autorizado" };
  return { ok: true as const };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();
    if (org.type !== "lab") {
      return NextResponse.json({ error: "Solo el laboratorio gestiona stock." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_inventory")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_inventory"), missing_flag: "manage_inventory" },
        { status: 403 },
      );
    }

    const validation = await validateBody(request, InventoryUpdate);
    if (validation.error) return validation.error;
    const body = validation.data;

    const supabase = await createClient();
    const own = await ensureOwnership(supabase, id, org.id);
    if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

    const updateData: Record<string, unknown> = {};
    if (body.name      !== undefined) updateData.name      = body.name.trim();
    if (body.unit      !== undefined) updateData.unit      = body.unit.trim() || "unidad";
    if (body.min_stock !== undefined) updateData.min_stock = body.min_stock;
    if (body.unit_cost !== undefined) updateData.unit_cost = body.unit_cost;
    if (body.notes     !== undefined) updateData.notes     = body.notes?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Sin cambios para aplicar." }, { status: 400 });
    }

    const { error } = await supabase.from("inventory_items").update(updateData).eq("id", id);
    if (error) {
      if ((error as any).code === "23505") {
        return NextResponse.json({ error: "Ya existe un material con ese nombre." }, { status: 409 });
      }
      throw error;
    }

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Error updating inventory item:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { org, role, permissions } = await getUserOrg();
    if (org.type !== "lab") {
      return NextResponse.json({ error: "Solo el laboratorio gestiona stock." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_inventory")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_inventory"), missing_flag: "manage_inventory" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const own = await ensureOwnership(supabase, id, org.id);
    if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

    // Movimientos relacionados se borran por CASCADE (FK ON DELETE CASCADE).
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Error deleting inventory item:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
