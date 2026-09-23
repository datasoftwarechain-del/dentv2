/**
 * [035_design_studio] Puerta única de cambio de estado.
 *
 * Ninguna pantalla escribe `design_orders.status` directamente: todo
 * pasa por acá. Eso es lo que permite que la máquina de estados de
 * lib/design/status.ts sea la verdad y no una sugerencia del front.
 *
 * Tres cosas que hace además de mover el estado:
 *   1. Aplica la compuerta de envío. Una orden sin escaneo o sin piezas
 *      no llega nunca a la cola del estudio.
 *   2. Libera el STL al aprobar. Antes de eso el cliente solo ve el
 *      render de previsualización: puede juzgar el trabajo sin poder
 *      quedarse con el entregable sin aprobarlo.
 *   3. Deja la vuelta asentada en la bitácora, con quién la pidió.
 */

import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import {
  resolveDesignAccess, requireDesignPermission, actionPermissionFor,
} from "@/lib/design/access";
import {
  canTransition, resolveRevisionCharge, statusAfterSubmit,
  type DesignOrderStatus,
} from "@/lib/design/status";
import { validateDesignOrderForSubmit } from "@/lib/design/order-validation";
import {
  includedRevisionsForOrder, REVISION_FEE_CODE, REVISION_FEE_LABEL,
} from "@/lib/design/services";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const StatusSchema = z.object({
  to_status: z.enum([
    "draft", "submitted", "needs_info", "assigned", "in_design",
    "internal_review", "client_review", "revision_requested",
    "approved", "delivered", "cancelled",
  ]),
  /** Obligatorio cuando la orden vuelve para atrás: sin motivo no se entiende qué corregir. */
  message: z.string().max(4000).nullish(),
  /** Solo al pasar a 'assigned'. */
  assigned_to: z.string().uuid().nullish(),
});

/** Estados que no se pueden pedir sin explicar por qué. */
const REQUIRES_MESSAGE: DesignOrderStatus[] = ["needs_info", "revision_requested", "cancelled"];

/** Entrar a cualquiera de estos es "el estudio empieza a trabajar". */
const ENTERS_QUEUE: DesignOrderStatus[] = ["submitted", "assigned", "in_design"];

/** Desde cualquiera de estos todavía no se trabajó nada. */
const PRE_QUEUE: DesignOrderStatus[] = ["draft", "needs_info", "awaiting_payment"];

async function isInvoicePaid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string | null,
): Promise<boolean> {
  if (!invoiceId) return false;
  const { data } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();
  return data?.status === "paid";
}

export async function POST(
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

    const { data: body, error: bodyError } = await validateBody(request, StatusSchema);
    if (bodyError) return bodyError;

    const { order, side, userId } = access;
    const from = order.status;
    const to = body.to_status as DesignOrderStatus;

    // ─── 0. Permiso fino del lado que actúa ───────────────────────
    const denied = requireDesignPermission(access, actionPermissionFor(side));
    if (denied) {
      return NextResponse.json({ error: denied.message }, { status: denied.status });
    }

    // ─── 1. ¿Puede este actor hacer esta transición? ──────────────
    if (!canTransition(from, to, side)) {
      return NextResponse.json(
        { error: `No se puede pasar de "${from}" a "${to}" desde tu rol.` },
        { status: 409 },
      );
    }

    const message = body.message?.trim() || null;
    if (REQUIRES_MESSAGE.includes(to) && !message) {
      return NextResponse.json(
        { error: "Indicá el motivo: sin eso del otro lado no se sabe qué corregir." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // ─── 2. Compuerta de envío ────────────────────────────────────
    if (to === "submitted") {
      const [{ data: items }, { data: files }] = await Promise.all([
        supabase
          .from("design_order_items")
          .select("service_code, tooth_positions, arch, quantity")
          .eq("design_order_id", id),
        supabase.from("design_order_files").select("kind").eq("design_order_id", id),
      ]);

      const check = validateDesignOrderForSubmit(items ?? [], files ?? []);
      if (!check.canSubmit) {
        return NextResponse.json(
          { error: "La orden todavía no se puede enviar.", details: check.errors },
          { status: 422 },
        );
      }
    }

    // ─── 3. Entregar al cliente exige que haya algo que mirar ─────
    if (to === "client_review") {
      const { count } = await supabase
        .from("design_order_files")
        .select("id", { count: "exact", head: true })
        .eq("design_order_id", id)
        .in("kind", ["output_design", "output_preview"]);

      if (!count) {
        return NextResponse.json(
          { error: "Subí el diseño o una previsualización antes de mandarla a aprobación." },
          { status: 422 },
        );
      }
    }

    // ─── 4. Cobro por adelantado: la puerta a la cola ─────────────
    // Un cliente prepago NO entra a la cola sin factura paga, venga de
    // donde venga. Las dos versiones anteriores de esta regla tenían
    // agujeros: solo miraban `draft → submitted`, así que una orden
    // devuelta con "faltan datos" y reenviada entraba sin pagar, y el
    // estudio podía asignarla desde needs_info directo. Ahora la regla
    // es una sola: ¿entra a la cola? ¿está paga? Si no, espera.
    //
    // La única excepción es el estudio confirmando a mano un pago que
    // llegó por fuera (awaiting_payment → submitted): ahí el dinero SÍ
    // llegó, y la sección 5b marca la factura.
    let efectivo: DesignOrderStatus = to;
    const manualConfirm = side === "studio" && from === "awaiting_payment" && to === "submitted";

    if (ENTERS_QUEUE.includes(to) && PRE_QUEUE.includes(from) && !manualConfirm) {
      if (access.paymentMode === "prepaid") {
        const paid = await isInvoicePaid(supabase, order.invoice_id);
        if (!paid) efectivo = "awaiting_payment";
      } else {
        efectivo = statusAfterSubmit(access.paymentMode);
        // En cuenta corriente statusAfterSubmit devuelve 'submitted'; si
        // el estudio pedía 'assigned' o 'in_design', se respeta.
        if (to !== "submitted") efectivo = to;
      }
    }

    // ─── 5. Asignación ────────────────────────────────────────────
    const patch: Record<string, unknown> = { status: efectivo };

    if (to === "assigned") {
      if (!body.assigned_to) {
        return NextResponse.json({ error: "Indicá qué diseñador toma el caso." }, { status: 400 });
      }
      // Si la puerta de pago la frenó, no se le asigna diseñador a algo
      // que todavía no se puede trabajar.
      if (efectivo === "assigned") patch.assigned_to = body.assigned_to;
    }
    if (to === "cancelled") {
      patch.cancel_reason = message;
    }
    // Una orden cancelada con factura sin pagar no puede seguir mostrando
    // deuda. Se anula la factura (no se borra: es historia contable).
    if (to === "cancelled" && order.invoice_id) {
      await supabase
        .from("invoices")
        .update({ invoice_voided_at: new Date().toISOString() })
        .eq("id", order.invoice_id)
        .eq("status", "pending");
    }

    const { data: updated, error: updateError } = await supabase
      .from("design_orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "No se pudo actualizar la orden" },
        { status: 500 },
      );
    }

    // ─── 5b. Confirmar el pago recibido por fuera ─────────────────
    // El estudio sacando una orden de 'awaiting_payment' significa una
    // sola cosa: el dinero llegó. Si solo se moviera el estado, la
    // factura quedaría en 'pending' para siempre y la plata cobrada
    // figuraría como deuda del cliente.
    if (from === "awaiting_payment" && efectivo === "submitted" && order.invoice_id) {
      await supabase
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", order.invoice_id)
        .eq("status", "pending"); // no pisa una factura ya anulada o paga
    }

    // ─── 6. Al aprobar se libera el entregable ────────────────────
    // Hasta acá el cliente veía el render pero no podía bajarse el STL.
    // En modo 'prepaid' la segunda compuerta (factura paga) la aplica
    // canClientDownload() al momento de firmar la URL.
    if (to === "approved") {
      await supabase
        .from("design_order_files")
        .update({ is_released: true })
        .eq("design_order_id", id)
        .eq("kind", "output_design");
    }

    // ─── 7. Revisión fuera de las incluidas: se factura ──────────
    // `order.revision_count` es el conteo ANTES de esta vuelta, así que
    // dice si la que se está pidiendo ahora entra en las incluidas o no.
    if (to === "revision_requested") {
      await chargeRevisionIfBillable(supabase, id, order, userId);
    }

    await supabase.from("design_order_events").insert({
      design_order_id: id,
      type: to === "revision_requested" ? "revision_request" : "status_change",
      actor_side: side,
      actor_id: userId,
      from_status: from,
      // Se asienta el estado REAL en el que quedó, no el que se pidió:
      // la bitácora tiene que poder explicar por qué la orden no entró
      // a la cola.
      to_status: efectivo,
      message: efectivo === "awaiting_payment" && !message
        ? "Enviada. Queda pendiente del pago por adelantado."
        : message,
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}


/**
 * Agrega la línea de cargo cuando la revisión pedida excede las incluidas.
 *
 * El precio sale del arancel `revision_fee` del catálogo del estudio. Si el
 * estudio no lo cargó, NO se cobra nada y queda una nota interna: es
 * preferible perder un cargo a facturar un número que nadie fijó.
 *
 * La línea entra en design_order_items, así que el trigger de facturación
 * la suma sola al aprobar. No hay un segundo camino de cobro que mantener.
 */
async function chargeRevisionIfBillable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  order: { studio_org_id: string; revision_count: number; invoice_id?: string | null },
  userId: string,
): Promise<void> {
  const { data: items } = await supabase
    .from("design_order_items")
    .select("service_code")
    .eq("design_order_id", orderId);

  const included = includedRevisionsForOrder(
    (items ?? []).map((i: any) => i.service_code as string),
  );

  const { data: feeItem } = await supabase
    .from("price_catalog")
    .select("id, base_price, unit_cost")
    .eq("org_id", order.studio_org_id)
    .eq("design_service_code", REVISION_FEE_CODE)
    .eq("is_active", true)
    .maybeSingle();

  const decision = resolveRevisionCharge({
    revisionCount: order.revision_count,
    includedRevisions: included,
    feePrice: feeItem?.base_price,
  });

  if (decision.kind === "included") return;

  if (decision.kind === "unpriced") {
    await supabase.from("design_order_events").insert({
      design_order_id: orderId,
      type: "message",
      actor_side: "system",
      message:
        `Esta revisión excede las ${included} incluidas, pero el arancel ` +
        `"${REVISION_FEE_LABEL}" no tiene precio cargado en el catálogo, ` +
        `así que no se facturó.`,
      is_internal: true,
    });
    return;
  }

  await supabase.from("design_order_items").insert({
    design_order_id: orderId,
    service_code: REVISION_FEE_CODE,
    catalog_item_id: feeItem!.id,
    description: `${REVISION_FEE_LABEL} n.º ${decision.revisionNumber} (incluidas: ${included})`,
    quantity: 1,
    unit_price: decision.price,
    unit_cost: feeItem!.unit_cost ?? null,
    is_revision_fee: true,
  });

  // En cuenta corriente la factura se emite al aprobar, y esta línea
  // entra sola. En prepago la factura ya se emitió y se pagó ANTES de
  // diseñar: el trigger no vuelve a disparar, y sin esto el cargo quedaba
  // en los ítems sin que nadie lo facturara jamás.
  const supplementary = await invoiceRevisionSeparatelyIfNeeded(
    supabase, orderId, order, decision.price, decision.revisionNumber,
  );

  await supabase.from("design_order_events").insert({
    design_order_id: orderId,
    type: "message",
    actor_side: "system",
    actor_id: userId,
    message: supplementary
      ? `Revisión n.º ${decision.revisionNumber}: excede las ${included} incluidas. ` +
        `Se emitió la factura ${supplementary} por el cargo.`
      : `Revisión n.º ${decision.revisionNumber}: excede las ${included} incluidas, ` +
        `se agregó el cargo correspondiente a la orden.`,
  });
}

/**
 * Factura aparte para el cargo de revisión cuando la principal ya se pagó.
 *
 * Devuelve el número de la factura nueva, o null si no hizo falta porque
 * la principal todavía está abierta y la línea entrará en ella.
 */
async function invoiceRevisionSeparatelyIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  order: { studio_org_id: string; invoice_id?: string | null },
  amount: number,
  revisionNumber: number,
): Promise<string | null> {
  if (!order.invoice_id) return null;

  const { data: main } = await supabase
    .from("invoices")
    .select("invoice_number, status, dentist_org_id, patient_name")
    .eq("id", order.invoice_id)
    .maybeSingle();

  if (!main || main.status !== "paid") return null;

  const number = `${main.invoice_number}-R${revisionNumber}`;

  const { data: created } = await supabase
    .from("invoices")
    .insert({
      invoice_number: number,
      lab_org_id: order.studio_org_id,
      dentist_org_id: main.dentist_org_id,
      design_order_id: orderId,
      patient_name: main.patient_name,
      work_type: REVISION_FEE_LABEL,
      status: "pending",
      subtotal: amount, tax_rate: 0, tax_amount: 0, total: amount,
      due_date: new Date().toISOString().slice(0, 10),
      notes: `${REVISION_FEE_LABEL} n.º ${revisionNumber} de la orden ${main.invoice_number}.`,
      totals_strict: false,
    })
    .select("invoice_number")
    .single();

  return created?.invoice_number ?? null;
}
