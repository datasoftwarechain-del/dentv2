/**
 * [035_design_studio] Ciclo de vida de una orden de diseño.
 *
 * A diferencia de la producción física (lib/order-status.ts), acá el
 * cliente es parte del flujo: recibe el STL, lo revisa y aprueba o pide
 * cambios. Ese ida y vuelta es el corazón del negocio, así que la
 * máquina de estados vive en un solo lugar y se testea: quién puede
 * mover qué, y hacia dónde.
 *
 * La regla que evita el conflicto más caro del rubro — "yo ya lo
 * aprobé" / "no, pediste otro cambio" — es que `approved` es terminal
 * salvo cancelación: una vez aprobado no se vuelve a in_design, se
 * abre una orden nueva.
 */

export type DesignOrderStatus =
  | "draft"
  | "submitted"
  | "awaiting_payment"
  | "needs_info"
  | "assigned"
  | "in_design"
  | "internal_review"
  | "client_review"
  | "revision_requested"
  | "approved"
  | "delivered"
  | "cancelled";

/** Quién ejecuta la transición. `system` es para triggers y automatismos. */
export type ActorSide = "client" | "studio" | "system";

export const DESIGN_STATUS_LABELS: Record<DesignOrderStatus, string> = {
  draft:              "Borrador",
  submitted:          "Recibida",
  awaiting_payment:   "Esperando pago",
  needs_info:         "Faltan datos",
  assigned:           "Asignada",
  in_design:          "En diseño",
  internal_review:    "Control interno",
  client_review:      "Esperando tu aprobación",
  revision_requested: "Cambios pedidos",
  approved:           "Aprobada",
  delivered:          "Entregada",
  cancelled:          "Cancelada",
};

/**
 * Cómo se le nombra el estado al CLIENTE cuando la etiqueta interna no
 * le dice nada útil. El cliente no necesita saber si el caso está
 * asignado o en control interno: para él sigue siendo "en proceso".
 */
const CLIENT_FACING_LABELS: Partial<Record<DesignOrderStatus, string>> = {
  assigned:        "En proceso",
  in_design:       "En proceso",
  internal_review: "En proceso",
  // Para el cliente no es un estado del sistema, es una cuenta por pagar.
  awaiting_payment: "Pendiente de pago",
};

export function getDesignStatusLabel(
  status: DesignOrderStatus,
  side: ActorSide = "studio",
): string {
  if (side === "client") {
    return CLIENT_FACING_LABELS[status] ?? DESIGN_STATUS_LABELS[status];
  }
  return DESIGN_STATUS_LABELS[status];
}

/** Paleta de marca DigitalDent — mismos tokens que lib/order-status.ts. */
export const DESIGN_STATUS_BADGE_CLASSES: Record<DesignOrderStatus, string> = {
  draft:              "bg-slate-100  text-slate-600   border-slate-200",
  submitted:          "bg-[#d2f2f3]  text-[#0d687d]   border-[#a8d8dc]",
  awaiting_payment:   "bg-amber-50   text-amber-800   border-amber-300",
  needs_info:         "bg-amber-50   text-amber-700   border-amber-200",
  assigned:           "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  in_design:          "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  internal_review:    "bg-[#b0dde0]  text-[#044c64]   border-[#4b8899]",
  client_review:      "bg-[#43eada]/20 text-[#044c64] border-[#43eada]",
  revision_requested: "bg-orange-50  text-orange-700  border-orange-200",
  approved:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  delivered:          "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled:          "bg-slate-100  text-slate-500   border-slate-200",
};

/**
 * Transiciones permitidas y quién puede ejecutarlas.
 *
 * Leer así: desde `submitted`, el estudio puede mandarla a needs_info,
 * assigned o cancelled; el cliente solo puede cancelarla.
 */
const TRANSITIONS: Record<DesignOrderStatus, Partial<Record<ActorSide, DesignOrderStatus[]>>> = {
  draft: {
    client: ["submitted", "cancelled"],
    studio: ["submitted", "cancelled"], // el estudio puede cargarla en nombre del cliente
  },
  submitted: {
    studio: ["needs_info", "assigned", "in_design", "cancelled"],
    client: ["cancelled"], // todavía no se tocó: puede arrepentirse
  },
  awaiting_payment: {
    // El camino normal lo hace solo: al registrarse el pago, el trigger
    // invoices_release_design_order la pasa a 'submitted'. Esta
    // transición manual es para el pago que llegó por fuera del sistema.
    studio: ["submitted", "needs_info", "cancelled"],
    client: ["cancelled"],
  },
  needs_info: {
    // La pelota está del lado del cliente: sube lo que falta y vuelve a enviar.
    client: ["submitted", "cancelled"],
    studio: ["assigned", "cancelled"],
  },
  assigned: {
    studio: ["in_design", "needs_info", "cancelled"],
  },
  in_design: {
    studio: ["internal_review", "client_review", "needs_info", "cancelled"],
  },
  internal_review: {
    // Vuelve a in_design si el QC interno lo rebota.
    studio: ["client_review", "in_design", "cancelled"],
  },
  client_review: {
    client: ["approved", "revision_requested"],
    // El estudio puede aprobar en nombre del cliente (aprobación por
    // teléfono o por WhatsApp), pero queda asentado en la bitácora.
    studio: ["approved", "in_design"],
  },
  revision_requested: {
    studio: ["in_design", "cancelled"],
  },
  approved: {
    // Terminal salvo entrega. No se vuelve atrás: ya está facturado.
    studio: ["delivered"],
  },
  delivered: {
    // Terminal. Un cambio posterior es una orden nueva.
  },
  cancelled: {
    // Terminal.
  },
};

/** Estados desde los que ya no se sale. */
export const DESIGN_STATUS_TERMINAL: DesignOrderStatus[] = ["delivered", "cancelled"];

/**
 * Estados en los que la pelota está del lado del CLIENTE.
 *
 * `draft` cuenta: una orden a medio armar espera una acción suya. Dejarla
 * afuera fue un error que costó caro — un pedido que entraba por el
 * formulario público y no llegaba a subir archivos quedaba en borrador,
 * fuera de la cola del estudio y fuera de la vista del cliente. Nadie
 * sabía que existía.
 */
export const DESIGN_STATUS_AWAITING_CLIENT: DesignOrderStatus[] = [
  "draft",
  "awaiting_payment",
  "needs_info",
  "client_review",
];

/**
 * Estados de una orden viva, la que todavía tiene algo pendiente.
 *
 * Incluye `draft` para que el cliente encuentre sus borradores sin tener
 * que buscarlos. No afecta la cola del estudio: esa usa
 * DESIGN_KANBAN_COLUMNS, y el contador del estudio resta los estados que
 * esperan al cliente.
 */
export const DESIGN_STATUS_ACTIVE: DesignOrderStatus[] = [
  "draft",
  "submitted",
  "awaiting_payment",
  "needs_info",
  "assigned",
  "in_design",
  "internal_review",
  "client_review",
  "revision_requested",
];

/** Columnas del tablero del equipo de diseño. */
export const DESIGN_KANBAN_COLUMNS = [
  { id: "submitted",       title: "Por asignar",    color: "bg-[#4b8899]" },
  { id: "assigned",        title: "Asignadas",      color: "bg-[#09919b]" },
  { id: "in_design",       title: "En diseño",      color: "bg-[#0d687d]" },
  { id: "internal_review", title: "Control interno", color: "bg-[#044c64]" },
  { id: "client_review",   title: "Con el cliente", color: "bg-[#43eada]" },
] as const;

/** ¿Puede este actor mover la orden de `from` a `to`? */
export function canTransition(
  from: DesignOrderStatus,
  to: DesignOrderStatus,
  side: ActorSide,
): boolean {
  if (from === to) return false;
  // `system` no se mueve solo: los triggers sellan tiempos, no cambian estado.
  if (side === "system") return false;
  return TRANSITIONS[from]?.[side]?.includes(to) ?? false;
}

/** Estados a los que este actor puede llevar la orden desde donde está. */
export function nextStatuses(from: DesignOrderStatus, side: ActorSide): DesignOrderStatus[] {
  if (side === "system") return [];
  return TRANSITIONS[from]?.[side] ?? [];
}

export function isTerminal(status: DesignOrderStatus): boolean {
  return DESIGN_STATUS_TERMINAL.includes(status);
}

export function isAwaitingClient(status: DesignOrderStatus): boolean {
  return DESIGN_STATUS_AWAITING_CLIENT.includes(status);
}

/**
 * ¿La próxima revisión se cobra?
 *
 * `revisionCount` es cuántas vueltas ya pidió el cliente. Mientras no
 * supere las incluidas, la siguiente sigue siendo sin cargo.
 */
export function isRevisionBillable(revisionCount: number, includedRevisions: number): boolean {
  return revisionCount >= includedRevisions;
}

/**
 * Qué hacer con una revisión que se pide: cobrarla, dejarla pasar, o
 * cobrarla pero no poder porque el estudio no fijó el precio.
 *
 * El tercer caso existe a propósito y no se resuelve inventando un
 * número: si el arancel "Revisión adicional" está en 0, la vuelta sale
 * gratis y queda una nota interna. Facturar un precio que nadie fijó es
 * peor que perder el cargo.
 */
export type RevisionCharge =
  | { kind: "included"; included: number }
  | { kind: "charge"; included: number; price: number; revisionNumber: number }
  | { kind: "unpriced"; included: number };

export function resolveRevisionCharge(params: {
  /** Vueltas ya pedidas, ANTES de esta. */
  revisionCount: number;
  includedRevisions: number;
  /** base_price del arancel `revision_fee`. null si el estudio no lo cargó. */
  feePrice: number | null | undefined;
}): RevisionCharge {
  const included = params.includedRevisions;

  if (!isRevisionBillable(params.revisionCount, included)) {
    return { kind: "included", included };
  }

  const price = Number(params.feePrice ?? 0);
  if (!(price > 0)) {
    return { kind: "unpriced", included };
  }

  return {
    kind: "charge",
    included,
    price,
    revisionNumber: params.revisionCount + 1,
  };
}

/**
 * ¿La orden espera plata antes de que alguien la toque?
 *
 * No es trabajo pendiente del estudio ni descuido del cliente: es una
 * factura abierta. Distinguirlo importa porque decide de qué lado del
 * mostrador está la pelota y si la orden entra o no al tablero.
 */
export function isAwaitingPayment(status: DesignOrderStatus): boolean {
  return status === "awaiting_payment";
}

/**
 * A qué estado va una orden recién enviada.
 *
 * En cuenta corriente entra derecho a la cola. En prepago se detiene
 * antes: el estudio no arranca un trabajo impago de alguien a quien no
 * le puede reclamar después.
 */
export function statusAfterSubmit(paymentMode: "account" | "prepaid"): DesignOrderStatus {
  return paymentMode === "prepaid" ? "awaiting_payment" : "submitted";
}

/**
 * ¿El cliente puede descargar el STL terminado?
 *
 * Dos compuertas independientes:
 *   - el archivo tiene que estar liberado (is_released), y
 *   - en modo prepaid, la factura tiene que estar paga.
 * En cuenta corriente ('account') alcanza con la liberación.
 */
export function canClientDownload(params: {
  isReleased: boolean;
  paymentMode: "account" | "prepaid";
  invoicePaid: boolean;
}): boolean {
  if (!params.isReleased) return false;
  if (params.paymentMode === "prepaid") return params.invoicePaid;
  return true;
}
