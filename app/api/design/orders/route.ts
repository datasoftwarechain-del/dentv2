/**
 * [035_design_studio] Órdenes de diseño: listado y alta.
 *
 * GET  — devuelve las órdenes que la org puede ver. La RLS de 035 ya
 *        filtra por organización; acá solo se decide el orden y qué
 *        campos se sirven según el lado del mostrador.
 * POST — crea la orden en 'draft' con sus ítems. El envío al estudio es
 *        una transición aparte (POST .../status), para que la compuerta
 *        de validación tenga un único lugar donde aplicarse.
 *
 *        Sirve a los dos lados: el CLIENTE manda `studio_org_id` y la
 *        orden queda a nombre de su propia organización; el ESTUDIO manda
 *        `client_org_id` y la carga en nombre de ese cliente. Es el caso
 *        real de un pedido que entra por teléfono o por WhatsApp, que
 *        antes obligaba a pedirle al cliente que la cargara él.
 */

import { getUserOrg } from "@/lib/get-user-org";
import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { isCollaboratorRole, hasPermission, permissionDeniedMessage } from "@/lib/permissions";
import { getDesignService } from "@/lib/design/services";
import { redactForClient } from "@/lib/design/access";
import { DESIGN_STATUS_ACTIVE } from "@/lib/design/status";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ItemSchema = z.object({
  service_code: z.string().min(1),
  catalog_item_id: z.string().uuid().nullish(),
  description: z.string().max(500).nullish(),
  tooth_positions: z.array(z.string().max(4)).max(32).nullish(),
  arch: z.enum(["upper", "lower", "both"]).nullish(),
  quantity: z.number().int().min(1).max(99).default(1),
  notes: z.string().max(1000).nullish(),
});

const CreateOrderSchema = z.object({
  /** Lo manda el CLIENTE: a qué estudio le pide el trabajo. */
  studio_org_id: z.string().uuid().optional(),
  /** Lo manda el ESTUDIO: para qué cliente carga la orden. */
  client_org_id: z.string().uuid().optional(),
  patient_ref: z.string().max(120).nullish(),
  case_notes: z.string().max(4000).nullish(),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  items: z.array(ItemSchema).min(1, "Agregá al menos un servicio").max(20),
}).refine(
  (v) => Boolean(v.studio_org_id) !== Boolean(v.client_org_id),
  { message: "Indicá el estudio (si sos el cliente) o el cliente (si sos el estudio), no ambos." },
);

/** GET /api/design/orders?scope=active|all */
export async function GET(request: NextRequest) {
  try {
    const { org, role, permissions } = await getUserOrg();

    if (isCollaboratorRole(role) && !hasPermission(permissions, "view_design_studio")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("view_design_studio"), missing_flag: "view_design_studio" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const scope = request.nextUrl.searchParams.get("scope") ?? "all";

    let query = supabase
      .from("design_orders")
      .select(`
        *,
        client_org:client_org_id(id, name, type),
        studio_org:studio_org_id(id, name),
        items:design_order_items(id, service_code, quantity, unit_price, arch, tooth_positions)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (scope === "active") {
      query = query.in("status", DESIGN_STATUS_ACTIVE);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Las notas internas del estudio no viajan al cliente.
    const rows = (data ?? []).map((o: any) =>
      redactForClient(o, o.studio_org_id === org.id ? "studio" : "client"),
    );

    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** POST /api/design/orders — crea un borrador con sus ítems */
export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { user, org, role, permissions } = await getUserOrg();

    if (isCollaboratorRole(role) && !hasPermission(permissions, "create_design_orders")) {
      return NextResponse.json(
        { error: permissionDeniedMessage("create_design_orders"), missing_flag: "create_design_orders" },
        { status: 403 },
      );
    }

    const { data: body, error: bodyError } = await validateBody(request, CreateOrderSchema);
    if (bodyError) return bodyError;

    const supabase = await createClient();

    // De qué lado del mostrador viene el pedido. NO se confía en lo que
    // manda el cuerpo: se deriva de la organización del usuario.
    const isStudioSide = org.type === "design_studio";

    const studioOrgId = isStudioSide ? org.id : body.studio_org_id;
    const clientOrgId = isStudioSide ? body.client_org_id : org.id;

    if (!studioOrgId || !clientOrgId) {
      return NextResponse.json(
        {
          error: isStudioSide
            ? "Indicá para qué cliente es la orden."
            : "Indicá a qué estudio se la pedís.",
        },
        { status: 400 },
      );
    }

    // La relación tiene que existir y estar activa, se mire desde donde
    // se mire. Sin esto cualquiera con una cuenta podría encolarle
    // trabajo gratis a un estudio, o un estudio cargarle órdenes a una
    // organización que nunca aceptó ser su cliente.
    const { data: relation } = await supabase
      .from("design_studio_clients")
      .select("status, turnaround_hours")
      .eq("studio_org_id", studioOrgId)
      .eq("client_org_id", clientOrgId)
      .maybeSingle();

    if (!relation) {
      return NextResponse.json(
        {
          error: isStudioSide
            ? "Esa organización no está habilitada como cliente tuyo."
            : "Tu organización no está habilitada como cliente de ese estudio.",
        },
        { status: 403 },
      );
    }
    if (relation.status === "suspended") {
      return NextResponse.json(
        { error: "La cuenta con ese cliente está suspendida." },
        { status: 403 },
      );
    }

    // Los códigos de servicio se validan contra el catálogo del módulo,
    // no contra lo que mande el cliente.
    const unknown = body.items.filter((i) => !getDesignService(i.service_code));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Servicio desconocido: ${unknown.map((i) => i.service_code).join(", ")}` },
        { status: 400 },
      );
    }

    // ─── Precios: se resuelven en el servidor, nunca se aceptan del cliente ───
    const catalogIds = body.items
      .map((i) => i.catalog_item_id)
      .filter((id): id is string => !!id);

    const priceById = new Map<string, { price: number; cost: number }>();
    if (catalogIds.length > 0) {
      const { data: catalogRows } = await supabase
        .from("price_catalog")
        .select("id, base_price, unit_cost")
        .eq("org_id", studioOrgId)
        .in("id", catalogIds);

      for (const row of catalogRows ?? []) {
        priceById.set(row.id, {
          price: Number(row.base_price ?? 0),
          cost: Number(row.unit_cost ?? 0),
        });
      }
    }

    const { data: order, error: orderError } = await supabase
      .from("design_orders")
      .insert({
        studio_org_id: studioOrgId,
        client_org_id: clientOrgId,
        status: "draft",
        priority: body.priority,
        patient_ref: body.patient_ref ?? null,
        case_notes: body.case_notes ?? null,
        due_at: relation.turnaround_hours
          ? new Date(Date.now() + relation.turnaround_hours * 3600_000).toISOString()
          : null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message ?? "No se pudo crear la orden" },
        { status: 500 },
      );
    }

    const itemRows = body.items.map((item) => {
      const priced = item.catalog_item_id ? priceById.get(item.catalog_item_id) : undefined;
      return {
        design_order_id: order.id,
        service_code: item.service_code,
        catalog_item_id: item.catalog_item_id ?? null,
        description: item.description ?? null,
        tooth_positions: item.tooth_positions?.length ? item.tooth_positions : null,
        arch: item.arch ?? null,
        quantity: item.quantity,
        unit_price: priced?.price ?? 0,
        unit_cost: priced?.cost ?? null,
        notes: item.notes ?? null,
      };
    });

    const { error: itemsError } = await supabase.from("design_order_items").insert(itemRows);

    if (itemsError) {
      // Sin ítems la orden no sirve y encima rompe la compuerta de envío.
      // Mejor no dejar el borrador huérfano.
      await supabase.from("design_orders").delete().eq("id", order.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    await supabase.from("design_order_events").insert({
      design_order_id: order.id,
      type: "status_change",
      actor_side: isStudioSide ? "studio" : "client",
      actor_id: user.id,
      to_status: "draft",
      message: isStudioSide ? "Orden cargada por el estudio" : "Orden creada",
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
