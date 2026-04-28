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

// [BLOQUE 6] Purchase update + delete (lab-only, manage_purchases).

const PurchaseUpdate = z.object({
  supplier_name: z.string().min(1).max(200).optional(),
  invoice_ref: z.string().max(120).nullable().optional(),
  total: z.number().min(0).optional(),
  purchase_date: z.string().min(1).optional(),
  category: z.enum(["materials", "equipment", "services", "other"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function ensureOwnership(supabase: any, id: string, labOrgId: string) {
  const { data: row, error } = await supabase
    .from("purchases")
    .select("id, lab_org_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false as const, status: 404 as const, msg: "Compra no encontrada" };
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
      return NextResponse.json({ error: "Solo el laboratorio gestiona compras." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_purchases")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_purchases"), missing_flag: "manage_purchases" },
        { status: 403 },
      );
    }

    const validation = await validateBody(request, PurchaseUpdate);
    if (validation.error) return validation.error;
    const body = validation.data;

    const supabase = await createClient();
    const own = await ensureOwnership(supabase, id, org.id);
    if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

    const updateData: Record<string, unknown> = {};
    if (body.supplier_name !== undefined) updateData.supplier_name = body.supplier_name.trim();
    if (body.invoice_ref   !== undefined) updateData.invoice_ref   = body.invoice_ref?.trim() || null;
    if (body.total         !== undefined) updateData.total         = body.total;
    if (body.purchase_date !== undefined) updateData.purchase_date = body.purchase_date;
    if (body.category      !== undefined) updateData.category      = body.category;
    if (body.notes         !== undefined) updateData.notes         = body.notes?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Sin cambios para aplicar." }, { status: 400 });
    }

    const { error } = await supabase.from("purchases").update(updateData).eq("id", id);
    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Error updating purchase:", err);
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
      return NextResponse.json({ error: "Solo el laboratorio gestiona compras." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_purchases")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_purchases"), missing_flag: "manage_purchases" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const own = await ensureOwnership(supabase, id, org.id);
    if (!own.ok) return NextResponse.json({ error: own.msg }, { status: own.status });

    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Error deleting purchase:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
