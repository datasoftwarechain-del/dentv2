/**
 * [035_design_studio] Tipos del Estudio de Diseño Digital.
 * Espejan el esquema de scripts/035_design_studio.sql.
 */

import type { DesignOrderStatus, ActorSide } from "./status";

export type DesignOrderPriority = "normal" | "urgent";
export type DesignArch = "upper" | "lower" | "both";
export type PaymentMode = "account" | "prepaid";

/** Clase de archivo dentro de una orden. Decide quién lo sube y quién lo ve. */
export type DesignFileKind =
  | "input_scan"       // escaneo intraoral del cliente
  | "input_reference"  // foto, radiografía, PDF de indicaciones
  | "output_design"    // el STL diseñado — el entregable
  | "output_preview"   // render para mirar sin bajar el STL
  | "annotation";      // marcas de una revisión

export interface DesignStudioClient {
  id: string;
  studio_org_id: string;
  client_org_id: string;
  status: "active" | "suspended";
  payment_mode: PaymentMode;
  turnaround_hours: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DesignOrder {
  id: string;
  order_number: string;
  studio_org_id: string;
  client_org_id: string;
  status: DesignOrderStatus;
  priority: DesignOrderPriority;
  /** Referencia del caso. No es un FK a patients: el cliente puede ser un laboratorio. */
  patient_ref: string | null;
  case_notes: string | null;
  /** Solo para el estudio. Nunca se serializa hacia el cliente. */
  internal_notes: string | null;
  due_at: string | null;
  submitted_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  /** Primera vez que llegó a client_review. Base del turnaround real. */
  first_delivery_at: string | null;
  approved_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  revision_count: number;
  invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Extra elegido sobre un servicio, con la misma forma que price_catalog.extras. */
export interface DesignExtra {
  name: string;
  price: number;
  qty?: number;
}

export interface DesignOrderItem {
  id: string;
  design_order_id: string;
  service_code: string;
  catalog_item_id: string | null;
  description: string | null;
  tooth_positions: string[] | null;
  arch: DesignArch | null;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  selected_extras: DesignExtra[];
  /** true = esta línea es el cargo por una revisión fuera de las incluidas. */
  is_revision_fee: boolean;
  notes: string | null;
  created_at: string;
}

export interface DesignOrderFile {
  id: string;
  design_order_id: string;
  kind: DesignFileKind;
  version: number;
  file_name: string;
  /** Ruta dentro del bucket privado `design-files`. Nunca una URL pública. */
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  checksum: string | null;
  /** Compuerta de entrega: false = existe pero el cliente todavía no lo puede bajar. */
  is_released: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface DesignOrderEvent {
  id: string;
  design_order_id: string;
  type: "status_change" | "message" | "file_upload" | "assignment" | "revision_request";
  actor_side: ActorSide;
  actor_id: string | null;
  from_status: DesignOrderStatus | null;
  to_status: DesignOrderStatus | null;
  message: string | null;
  is_internal: boolean;
  created_at: string;
}

/** Orden con todo lo que cuelga, tal como la arma el detalle. */
export interface DesignOrderDetail extends DesignOrder {
  items: DesignOrderItem[];
  files: DesignOrderFile[];
  events: DesignOrderEvent[];
  client_org?: { id: string; name: string; type: string } | null;
  studio_org?: { id: string; name: string } | null;
}
