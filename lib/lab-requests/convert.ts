/**
 * [040_lab_requests] Traducción pura de una solicitud a una orden.
 *
 * Sin I/O: recibe la solicitud y lo que el laboratorio decidió en el
 * diálogo de conversión, devuelve las filas a insertar. Así se prueba
 * sin base y el endpoint solo hace el ida y vuelta.
 */

import { getLabProduct, type LabWorkType } from "./products";
import type { LabRequest } from "./types";

/**
 * Mismo criterio que create-order-dialog.tsx: "ORDEN N" con N = máximo
 * existente + 1. Se mantiene el formato porque facturación, Kanban y
 * los archivos de casos lo parsean con /ORDEN (\d+)/.
 */
export function nextOrderNumber(existing: Array<{ order_number: string | null }>): string {
  let max = 0;
  for (const row of existing) {
    const m = row.order_number?.match(/ORDEN (\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ORDEN ${max + 1}`;
}

export interface ConvertDecision {
  dentist_org_id: string;
  work_type: LabWorkType;
  catalog_item_id?: string | null;
  unit_price?: number | null;
  due_date?: string | null;
  internal_notes?: string | null;
}

export interface ConvertedRows {
  order: {
    order_number: string;
    dentist_org_id: string;
    lab_org_id: string;
    status: "received";
    priority: "normal" | "urgent";
    due_date: string | null;
    notes: string;
    internal_notes: string | null;
  };
  item: {
    work_type: LabWorkType;
    material: string | null;
    shade: string | null;
    tooth_positions: string[] | null;
    quantity: number;
    unit_price: number | null;
    catalog_item_id: string | null;
    selected_extras: never[];
  };
}

/**
 * Notas visibles de la orden: se arma con lo que el profesional escribió
 * y con los datos de contacto y entrega, para que el taller no tenga
 * que abrir la solicitud original.
 */
export function buildOrderNotes(request: LabRequest): string {
  const product = getLabProduct(request.product_key);
  const lines: string[] = [
    `Solicitud web ${request.request_number} · ${product?.label ?? request.product_key}`,
    `Profesional: ${request.professional_name} · ${request.clinic_name}`,
    `Contacto: ${request.email}${request.phone ? ` · ${request.phone}` : ""}`,
  ];
  const delivery = [request.address, request.city, request.department].filter(Boolean).join(", ");
  if (delivery) lines.push(`Entrega: ${delivery}`);
  if (request.patient_ref) lines.push(`Ref. paciente: ${request.patient_ref}`);
  if (request.existing_case_ref) lines.push(`Caso existente: ${request.existing_case_ref}`);
  if (request.notes) lines.push("", request.notes);
  return lines.join("\n");
}

export function buildOrderFromRequest(
  request: LabRequest,
  decision: ConvertDecision,
  orderNumber: string,
): ConvertedRows {
  const product = getLabProduct(request.product_key);
  const price = decision.unit_price;

  return {
    order: {
      order_number: orderNumber,
      dentist_org_id: decision.dentist_org_id,
      lab_org_id: request.lab_org_id,
      status: "received",
      priority: request.urgency === "urgent" ? "urgent" : "normal",
      due_date: decision.due_date ?? null,
      notes: buildOrderNotes(request),
      internal_notes: decision.internal_notes ?? null,
    },
    item: {
      work_type: decision.work_type,
      material: request.material ?? product?.material ?? null,
      shade: request.shade,
      tooth_positions:
        request.tooth_positions && request.tooth_positions.length > 0 ? request.tooth_positions : null,
      quantity: request.quantity,
      // 0 es un precio válido (trabajo sin costo); null es "sin definir".
      unit_price: price === undefined || price === null ? null : price,
      catalog_item_id: decision.catalog_item_id ?? request.catalog_item_id ?? null,
      selected_extras: [],
    },
  };
}
