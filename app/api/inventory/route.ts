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

// [BLOQUE 6] Inventory items endpoints (lab-only).
// GET  → list items.       view_inventory.
// POST → create item.      manage_inventory.

const InventoryInput = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(50).default("unidad"),
  current_stock: z.number().min(0).default(0),
  min_stock: z.number().min(0).default(0),
  unit_cost: z.number().min(0).default(0),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const { org, role, permissions } = await getUserOrg();
    if (org.type !== "lab") {
      return NextResponse.json({ error: "Solo el laboratorio gestiona stock." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "view_inventory")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("view_inventory"), missing_flag: "view_inventory" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("lab_org_id", org.id)
      .order("name");

    if (error) throw error;

    // Sanitizer: hide unit_cost when caller has view_inventory but not view_billing_amounts.
    const canViewAmounts = !isCollaboratorRole(role) || !!permissions?.view_billing_amounts;
    const items = (data ?? []).map((row) =>
      canViewAmounts ? row : { ...row, unit_cost: undefined },
    );

    return NextResponse.json({ items, canViewAmounts });
  } catch (err: any) {
    logger.error("Error listing inventory:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
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

    const validation = await validateBody(request, InventoryInput);
    if (validation.error) return validation.error;
    const body = validation.data;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        lab_org_id: org.id,
        name: body.name.trim(),
        unit: body.unit?.trim() || "unidad",
        current_stock: body.current_stock,
        min_stock: body.min_stock,
        unit_cost: body.unit_cost,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un material con ese nombre en el inventario." },
          { status: 409 },
        );
      }
      throw error;
    }

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    logger.error("Error creating inventory item:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
