import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import { logger } from "@/lib/logger";
import {
  isCollaboratorRole,
  hasPermission,
  permissionDeniedMessage,
} from "@/lib/permissions";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// [BLOQUE 4] Client pricing endpoints.
// GET  /api/clients/[id]/pricing → list catalog items + current overrides for this client.
// PUT  /api/clients/[id]/pricing → upsert (custom_price !== null) or delete (null) one override.
//
// id in the path is the dentist_org_id (the client). The lab is the caller's org.
// view_pricing_admin → GET. manage_pricing → PUT. Lab-only.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dentistOrgId } = await params;
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio gestiona aranceles personalizados." },
        { status: 403 },
      );
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "view_pricing_admin")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("view_pricing_admin"), missing_flag: "view_pricing_admin" },
        { status: 403 },
      );
    }

    const supabase = await createClient();

    // Confirm relation exists (defense — RLS already filters but be explicit).
    const { data: relation } = await supabase
      .from("lab_dentist_relations")
      .select("id")
      .eq("lab_org_id", org.id)
      .eq("dentist_org_id", dentistOrgId)
      .maybeSingle();
    if (!relation) {
      return NextResponse.json(
        { error: "Cliente no conectado a este laboratorio." },
        { status: 404 },
      );
    }

    const [{ data: catalog }, { data: overrides }] = await Promise.all([
      supabase
        .from("price_catalog")
        .select("id, name, category, base_price, is_active, sort_order")
        .eq("org_id", org.id)
        .eq("is_active", true)
        .order("category")
        .order("sort_order")
        .order("name"),
      supabase
        .from("client_price_overrides")
        .select("catalog_item_id, custom_price, notes, updated_at")
        .eq("lab_org_id", org.id)
        .eq("dentist_org_id", dentistOrgId),
    ]);

    const overrideMap = new Map<string, { custom_price: number; notes: string | null; updated_at: string }>();
    for (const o of overrides ?? []) {
      overrideMap.set(o.catalog_item_id, {
        custom_price: Number(o.custom_price),
        notes: o.notes ?? null,
        updated_at: o.updated_at,
      });
    }

    const items = (catalog ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      base_price: Number(item.base_price),
      override: overrideMap.get(item.id) ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    logger.error("Error fetching client pricing:", err);
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 },
    );
  }
}

const PutSchema = z.object({
  catalog_item_id: z.string().uuid(),
  /** null → delete the override (revert to general price). number ≥ 0 → upsert. */
  custom_price: z.number().min(0).nullable(),
  notes: z.string().max(500).nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id: dentistOrgId } = await params;
    const { org, role, permissions } = await getUserOrg();

    if (org.type !== "lab") {
      return NextResponse.json(
        { error: "Solo el laboratorio gestiona aranceles personalizados." },
        { status: 403 },
      );
    }
    if (isCollaboratorRole(role) && !hasPermission(permissions, "manage_pricing")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("manage_pricing"), missing_flag: "manage_pricing" },
        { status: 403 },
      );
    }

    const validation = await validateBody(request, PutSchema);
    if (validation.error) return validation.error;
    const { catalog_item_id, custom_price, notes } = validation.data;

    const supabase = await createClient();

    // Confirm relation + catalog ownership before touching the override.
    const [{ data: relation }, { data: catalogItem }] = await Promise.all([
      supabase
        .from("lab_dentist_relations")
        .select("id")
        .eq("lab_org_id", org.id)
        .eq("dentist_org_id", dentistOrgId)
        .maybeSingle(),
      supabase
        .from("price_catalog")
        .select("id, org_id")
        .eq("id", catalog_item_id)
        .maybeSingle(),
    ]);

    if (!relation) {
      return NextResponse.json(
        { error: "Cliente no conectado a este laboratorio." },
        { status: 404 },
      );
    }
    if (!catalogItem || catalogItem.org_id !== org.id) {
      return NextResponse.json(
        { error: "Item del catálogo no encontrado." },
        { status: 404 },
      );
    }

    if (custom_price === null) {
      // Delete override → revert to general price.
      const { error: delErr } = await supabase
        .from("client_price_overrides")
        .delete()
        .eq("lab_org_id", org.id)
        .eq("dentist_org_id", dentistOrgId)
        .eq("catalog_item_id", catalog_item_id);
      if (delErr) throw delErr;
    } else {
      // Upsert (UNIQUE on lab+dentist+catalog_item handles dedup).
      const { error: upErr } = await supabase
        .from("client_price_overrides")
        .upsert(
          {
            lab_org_id: org.id,
            dentist_org_id: dentistOrgId,
            catalog_item_id,
            custom_price,
            notes: notes ?? null,
          },
          { onConflict: "lab_org_id,dentist_org_id,catalog_item_id" },
        );
      if (upErr) throw upErr;
    }

    revalidatePath(`/dashboard/billing/accounts/${dentistOrgId}`);
    revalidatePath(`/dashboard/clients/${dentistOrgId}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Error updating client pricing:", err);
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 },
    );
  }
}
