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

// [BLOQUE 6] Purchases endpoints (lab-only).
// GET  → list purchases for the lab.
//        view_purchases. Without view_billing_amounts, monetary fields
//        (total) are stripped from each row before returning.
// POST → create purchase. manage_purchases.

const PURCHASE_CATEGORIES = ["materials", "equipment", "services", "other"] as const;

const PurchaseInput = z.object({
  supplier_name: z.string().min(1).max(200),
  invoice_ref: z.string().max(120).nullable().optional(),
  total: z.number().min(0),
  purchase_date: z.string().min(1), // ISO date
  category: z.enum(PURCHASE_CATEGORIES).default("materials"),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const { org, role, permissions } = await getUserOrg();
    if (org.type !== "lab") {
      return NextResponse.json({ error: "Solo el laboratorio gestiona compras." }, { status: 403 });
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "view_purchases")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("view_purchases"), missing_flag: "view_purchases" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("lab_org_id", org.id)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Sanitizer: hide monetary fields when caller has view_purchases but not view_billing_amounts.
    const canViewAmounts = !isCollaboratorRole(role) || !!permissions?.view_billing_amounts;
    const items = (data ?? []).map((row) =>
      canViewAmounts ? row : { ...row, total: undefined },
    );

    return NextResponse.json({ items, canViewAmounts });
  } catch (err: any) {
    logger.error("Error listing purchases:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
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

    const validation = await validateBody(request, PurchaseInput);
    if (validation.error) return validation.error;
    const body = validation.data;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        lab_org_id: org.id,
        supplier_name: body.supplier_name.trim(),
        invoice_ref: body.invoice_ref?.trim() || null,
        total: body.total,
        purchase_date: body.purchase_date,
        category: body.category,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    logger.error("Error creating purchase:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
