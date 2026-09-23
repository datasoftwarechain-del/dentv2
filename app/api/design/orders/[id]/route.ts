/**
 * [035_design_studio] Detalle de una orden de diseño.
 *
 * GET    — la orden con ítems, archivos y bitácora. Lo que se sirve
 *          depende del lado: el cliente no ve notas internas ni eventos
 *          marcados como internos.
 * PATCH  — editar. Solo en 'draft' y solo el cliente: una vez enviada,
 *          cambiar el pedido por atrás dejaría al diseñador trabajando
 *          sobre indicaciones que ya no existen.
 * DELETE — descartar un borrador. Las órdenes ya enviadas se cancelan
 *          (POST .../status), no se borran: tienen historia.
 */

import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import {
  resolveDesignAccess, redactForClient, requireDesignPermission, actionPermissionFor,
} from "@/lib/design/access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PatchSchema = z.object({
  patient_ref: z.string().max(120).nullish(),
  case_notes: z.string().max(4000).nullish(),
  priority: z.enum(["normal", "urgent"]).optional(),
  /** Solo el estudio. Se ignora si lo manda el cliente. */
  internal_notes: z.string().max(4000).nullish(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { access, error: accessError } = await resolveDesignAccess(id);
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: accessError.status });
    }

    const { side, order, paymentMode } = access;
    const supabase = await createClient();

    const [{ data: items }, { data: files }, { data: events }, { data: orgs }] = await Promise.all([
      supabase.from("design_order_items").select("*").eq("design_order_id", id).order("created_at"),
      supabase
        .from("design_order_files")
        .select("*")
        .eq("design_order_id", id)
        .order("kind")
        .order("version", { ascending: false }),
      supabase
        .from("design_order_events")
        .select("*")
        .eq("design_order_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("organizations")
        .select("id, name, type")
        .in("id", [order.studio_org_id, order.client_org_id]),
    ]);

    // La RLS ya esconde los eventos internos del cliente, pero filtramos
    // otra vez acá: si algún día alguien afloja la policy, esto aguanta.
    const visibleEvents =
      side === "studio" ? (events ?? []) : (events ?? []).filter((e: any) => !e.is_internal);

    const orgById = new Map((orgs ?? []).map((o: any) => [o.id, o]));

    return NextResponse.json({
      data: {
        ...redactForClient(order, side),
        items: items ?? [],
        files: files ?? [],
        events: visibleEvents,
        studio_org: orgById.get(order.studio_org_id) ?? null,
        client_org: orgById.get(order.client_org_id) ?? null,
        side,
        payment_mode: paymentMode,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { access, error: accessError } = await resolveDesignAccess(id);
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: accessError.status });
    }

    const { data: body, error: bodyError } = await validateBody(request, PatchSchema);
    if (bodyError) return bodyError;

    const { side, order } = access;

    const denied = requireDesignPermission(access, actionPermissionFor(side));
    if (denied) {
      return NextResponse.json({ error: denied.message }, { status: denied.status });
    }

    const patch: Record<string, unknown> = {};

    if (side === "client") {
      if (order.status !== "draft") {
        return NextResponse.json(
          { error: "La orden ya fue enviada. Pedí los cambios desde la bitácora." },
          { status: 409 },
        );
      }
      if (body.patient_ref !== undefined) patch.patient_ref = body.patient_ref;
      if (body.case_notes !== undefined) patch.case_notes = body.case_notes;
      if (body.priority !== undefined) patch.priority = body.priority;
    } else {
      // El estudio puede anotar internamente en cualquier momento.
      if (body.internal_notes !== undefined) patch.internal_notes = body.internal_notes;
      if (body.priority !== undefined) patch.priority = body.priority;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("design_orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message ?? "No se pudo actualizar" }, { status: 500 });
    }

    return NextResponse.json({ data: redactForClient(updated, side) });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const { access, error: accessError } = await resolveDesignAccess(id);
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: accessError.status });
    }

    const denied = requireDesignPermission(access, actionPermissionFor(access.side));
    if (denied) {
      return NextResponse.json({ error: denied.message }, { status: denied.status });
    }

    // Solo borradores. Lo enviado se cancela, no se borra: una orden con
    // historia (y quizá con factura) no puede desaparecer de la nada.
    if (access.order.status !== "draft") {
      return NextResponse.json(
        { error: "Solo se pueden descartar borradores. Cancelá la orden en su lugar." },
        { status: 409 },
      );
    }

    const supabase = await createClient();

    // Los archivos del borrador se van con él: si la orden no existe,
    // su carpeta en el bucket queda sin dueño y sin forma de autorizarse.
    const { data: files } = await supabase
      .from("design_order_files")
      .select("storage_path")
      .eq("design_order_id", id);

    if (files && files.length > 0) {
      await supabase.storage
        .from("design-files")
        .remove(files.map((f: any) => f.storage_path));
    }

    // Los ítems, archivos y eventos caen por ON DELETE CASCADE.
    const { error } = await supabase.from("design_orders").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
