import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import {
  isCollaboratorRole,
  hasPermission,
  canManagePricing,
  permissionDeniedMessage,
} from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ============================================================
// /api/costs/catalog — gestión del costo de producción por arancel
// ============================================================
// Feature aislada (BLOQUE 7 — Rentabilidad). No toca ningún flujo
// existente: opera sobre la columna additiva price_catalog.unit_cost.
//
// Roles (los colaboradores NUNCA ven precios/costos sin permiso):
//   - GET  → lab + (admin | view_financial_dashboard). Devuelve el
//            arancel con base_price y unit_cost para la tabla editable.
//   - PUT  → lab + (admin | manage_pricing). Actualiza unit_cost de un
//            ítem que pertenezca a la org (ownership por org_id).
// ============================================================

/** GET — catálogo de la org con precio de venta y costo de producción */
export async function GET(_request: NextRequest) {
  try {
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio gestiona costos de producción." },
        { status: 403 },
      );
    }

    // Ver costos = información financiera. Gate en view_financial_dashboard.
    if (isCollaboratorRole(role) && !hasPermission(permissions, "view_financial_dashboard")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("view_financial_dashboard"), missing_flag: "view_financial_dashboard" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_catalog")
      .select("id, category, name, base_price, unit_cost, is_active")
      .eq("org_id", org.id)
      .order("category")
      .order("sort_order")
      .order("name");

    if (error) throw error;

    return NextResponse.json({
      items: data ?? [],
      canManage: canManagePricing(permissions),
    });
  } catch (err: any) {
    logger.error("Error listing production costs:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

const UpdateCostSchema = z.object({
  id: z.string().uuid("id debe ser un UUID válido"),
  unit_cost: z.number().min(0, "El costo no puede ser negativo").max(99999999),
});

/** PUT — actualiza el costo de producción de un ítem del catálogo */
export async function PUT(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio gestiona costos de producción." },
        { status: 403 },
      );
    }

    // Editar costos = gestión de aranceles. Gate en manage_pricing.
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_pricing")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_pricing"), missing_flag: "manage_pricing" },
        { status: 403 },
      );
    }

    const validation = await validateBody(request, UpdateCostSchema);
    if (validation.error) return validation.error;
    const { id, unit_cost } = validation.data;

    const supabase = await createClient();

    // Ownership: el ítem debe pertenecer a esta org.
    const { data, error } = await supabase
      .from("price_catalog")
      .update({ unit_cost, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", org.id)
      .select("id, unit_cost")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    logger.error("Error updating production cost:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
