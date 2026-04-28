/**
 * Collaborator permission system for DigitalDent v2.
 *
 * Admins always have full access (permissions field is empty {}).
 * Collaborators have explicit boolean flags controlling what they can see/do.
 *
 * BLOQUE 1.5 — Permission model expansion:
 *   - 10 new flags added (edit_orders, delete_orders, manage_billing,
 *     view_pricing_admin, manage_pricing, view_purchases, manage_purchases,
 *     view_inventory, manage_inventory, view_financial_dashboard).
 *   - New presets billing_clerk, inventory_clerk.
 *   - Existing assistant preset gains edit_orders=true.
 *   - sanitizeInvoiceForCollaborator helper for API payload defense.
 *   - permissionDeniedMessage helper for actionable 403 errors.
 *
 * SECURITY NOTE — Lateral fix included in BLOQUE 1.5:
 *   Previously, app/api/orders/[id]/route.ts checked `create_orders` to
 *   authorize order DELETE. That conflated "create" and "destroy" — any
 *   collaborator who could create orders could also delete them. The fix
 *   in BLOQUE 1.5 introduces a dedicated `delete_orders` flag and the
 *   route now checks it. This flag is NOT auto-granted to collaborators
 *   who already had `create_orders`. After deploy, collaborators that
 *   could delete orders before will lose that ability until an admin
 *   explicitly grants `delete_orders` from the collaborators settings.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollaboratorPermissions {
  // ── Sections (what pages the user can visit) ──
  view_dashboard: boolean;
  view_patients: boolean;        // Dentist only
  view_appointments: boolean;    // Dentist only
  view_orders: boolean;
  view_cases: boolean;
  view_schedule: boolean;
  view_kanban: boolean;          // Lab only
  view_billing: boolean;
  view_clients: boolean;         // Lab only

  // ── Financial visibility ──
  view_prices: boolean;              // See service prices in orders & catalog
  view_billing_amounts: boolean;     // See monetary amounts in billing page
  view_financial_dashboard: boolean; // [BLOQUE 1.5] See KPIs/margins/aggregates (BLOQUE 6 analytics tab)

  // ── Pricing admin (lab) ──
  view_pricing_admin: boolean;       // [BLOQUE 1.5] See catalog + per-client price overrides (BLOQUE 4)
  manage_pricing: boolean;           // [BLOQUE 1.5] Create/edit/delete catalog items + overrides (BLOQUE 4)

  // ── Purchases & Inventory (lab — BLOQUE 6) ──
  view_purchases: boolean;           // [BLOQUE 1.5] See purchases tab
  manage_purchases: boolean;         // [BLOQUE 1.5] Create/edit/delete purchases
  view_inventory: boolean;           // [BLOQUE 1.5] See inventory tab
  manage_inventory: boolean;         // [BLOQUE 1.5] Adjust stock and movements

  // ── Actions on orders ──
  create_orders: boolean;
  edit_orders: boolean;              // [BLOQUE 1.5] Modify existing orders (work_type, patient, priority, notes)
  delete_orders: boolean;            // [BLOQUE 1.5] Delete order + items (separated from create_orders)
  update_order_status: boolean;

  // ── Actions on appointments / patients ──
  create_appointments: boolean;      // Dentist only
  create_patients: boolean;          // Dentist only

  // ── Billing actions ──
  manage_billing: boolean;           // [BLOQUE 1.5] Issue manual invoices, edit strict, delete invoices (BLOQUE 3)
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PERMISSION_KEYS = [
  "view_dashboard",
  "view_patients",
  "view_appointments",
  "view_orders",
  "view_cases",
  "view_schedule",
  "view_kanban",
  "view_billing",
  "view_clients",
  "view_prices",
  "view_billing_amounts",
  "view_financial_dashboard",
  "view_pricing_admin",
  "manage_pricing",
  "view_purchases",
  "manage_purchases",
  "view_inventory",
  "manage_inventory",
  "create_orders",
  "edit_orders",
  "delete_orders",
  "update_order_status",
  "create_appointments",
  "create_patients",
  "manage_billing",
] as const satisfies (keyof CollaboratorPermissions)[];

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Labels for each permission (used in the settings UI) */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_dashboard:           "Ver dashboard principal",
  view_patients:            "Ver pacientes",
  view_appointments:        "Ver citas",
  view_orders:              "Ver órdenes",
  view_cases:               "Ver casos digitales",
  view_schedule:            "Ver agenda semanal",
  view_kanban:              "Ver tablero de producción",
  view_billing:             "Ver facturación",
  view_clients:             "Ver clínicas / clientes",
  view_prices:              "Ver precios de servicios",
  view_billing_amounts:     "Ver montos en facturación",
  view_financial_dashboard: "Ver KPIs y análisis financiero",
  view_pricing_admin:       "Ver catálogo y aranceles personalizados",
  manage_pricing:           "Gestionar catálogo y aranceles",
  view_purchases:           "Ver compras",
  manage_purchases:         "Gestionar compras",
  view_inventory:           "Ver stock",
  manage_inventory:         "Gestionar stock",
  create_orders:            "Crear órdenes",
  edit_orders:              "Editar órdenes existentes",
  delete_orders:            "Eliminar órdenes",
  update_order_status:      "Cambiar estado de órdenes",
  create_appointments:      "Crear citas",
  create_patients:          "Agregar pacientes",
  manage_billing:           "Gestionar facturación (emitir/editar/eliminar)",
};

/** Which sections apply to which org type */
export const DENTIST_PERMISSIONS: PermissionKey[] = [
  "view_dashboard", "view_patients", "view_appointments", "view_orders",
  "view_cases", "view_schedule", "view_billing",
  "view_prices", "view_billing_amounts", "view_financial_dashboard",
  "create_orders", "edit_orders", "delete_orders", "update_order_status",
  "create_appointments", "create_patients", "manage_billing",
];

export const LAB_PERMISSIONS: PermissionKey[] = [
  "view_dashboard", "view_orders", "view_cases", "view_schedule",
  "view_kanban", "view_billing", "view_clients",
  "view_prices", "view_billing_amounts", "view_financial_dashboard",
  "view_pricing_admin", "manage_pricing",
  "view_purchases", "manage_purchases",
  "view_inventory", "manage_inventory",
  "create_orders", "edit_orders", "delete_orders", "update_order_status",
  "manage_billing",
];

/** Group labels shown as section headers in the permissions dialog */
export const PERMISSION_GROUPS: {
  label: string;
  description: string;
  keys: PermissionKey[];
}[] = [
  {
    label: "Secciones visibles",
    description: "Qué apartados puede ver este colaborador",
    keys: [
      "view_dashboard", "view_patients", "view_appointments", "view_orders",
      "view_cases", "view_schedule", "view_kanban", "view_billing", "view_clients",
      "view_purchases", "view_inventory",
    ],
  },
  {
    label: "Información financiera",
    description: "Acceso a precios, montos y análisis monetario",
    keys: [
      "view_prices", "view_billing_amounts", "view_financial_dashboard",
      "view_pricing_admin",
    ],
  },
  {
    label: "Acciones permitidas",
    description: "Qué puede crear o modificar",
    keys: [
      "create_orders", "edit_orders", "delete_orders", "update_order_status",
      "create_appointments", "create_patients",
      "manage_billing", "manage_pricing", "manage_purchases", "manage_inventory",
    ],
  },
];

// ─── Default values ───────────────────────────────────────────────────────────

/** Zero-access permissions — use as starting point for custom config */
export const EMPTY_PERMISSIONS: CollaboratorPermissions = {
  view_dashboard: false,
  view_patients: false,
  view_appointments: false,
  view_orders: false,
  view_cases: false,
  view_schedule: false,
  view_kanban: false,
  view_billing: false,
  view_clients: false,
  view_prices: false,
  view_billing_amounts: false,
  view_financial_dashboard: false,
  view_pricing_admin: false,
  manage_pricing: false,
  view_purchases: false,
  manage_purchases: false,
  view_inventory: false,
  manage_inventory: false,
  create_orders: false,
  edit_orders: false,
  delete_orders: false,
  update_order_status: false,
  create_appointments: false,
  create_patients: false,
  manage_billing: false,
};

/** Full access — used for admins when converting to CollaboratorPermissions shape */
export const ALL_PERMISSIONS: CollaboratorPermissions = {
  view_dashboard: true,
  view_patients: true,
  view_appointments: true,
  view_orders: true,
  view_cases: true,
  view_schedule: true,
  view_kanban: true,
  view_billing: true,
  view_clients: true,
  view_prices: true,
  view_billing_amounts: true,
  view_financial_dashboard: true,
  view_pricing_admin: true,
  manage_pricing: true,
  view_purchases: true,
  manage_purchases: true,
  view_inventory: true,
  manage_inventory: true,
  create_orders: true,
  edit_orders: true,
  delete_orders: true,
  update_order_status: true,
  create_appointments: true,
  create_patients: true,
  manage_billing: true,
};

// ─── Presets ──────────────────────────────────────────────────────────────────

export interface PermissionPreset {
  id: string;
  label: string;
  description: string;
  permissions: CollaboratorPermissions;
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: "receptionist",
    label: "Recepcionista",
    description: "Gestiona agenda y pacientes, sin acceso a finanzas",
    permissions: {
      ...EMPTY_PERMISSIONS,
      view_dashboard: true,
      view_patients: true,
      view_appointments: true,
      view_schedule: true,
      create_appointments: true,
      create_patients: true,
    },
  },
  {
    id: "assistant",
    label: "Asistente de laboratorio",
    description: "Gestiona y actualiza órdenes sin ver precios",
    permissions: {
      ...EMPTY_PERMISSIONS,
      view_dashboard: true,
      view_orders: true,
      view_schedule: true,
      view_kanban: true,
      create_orders: true,
      edit_orders: true, // [BLOQUE 1.5] separated from create_orders
      update_order_status: true,
    },
  },
  {
    id: "technician",
    label: "Técnico / Asistente clínico",
    description: "Ve órdenes y agenda, puede cambiar estados",
    permissions: {
      ...EMPTY_PERMISSIONS,
      view_dashboard: true,
      view_orders: true,
      view_cases: true,
      view_schedule: true,
      update_order_status: true,
    },
  },
  {
    id: "billing_clerk",
    label: "Encargado de facturación",
    description: "Emite, edita y elimina facturas. Sin aranceles ni stock.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      view_dashboard: true,
      view_billing: true,
      view_billing_amounts: true,
      manage_billing: true,
      view_clients: true,    // For lab; dentist UI ignores this via LAB_PERMISSIONS filter
      view_patients: true,   // For dentist; lab UI ignores via DENTIST_PERMISSIONS filter
    },
  },
  {
    id: "inventory_clerk",
    label: "Encargado de stock y compras",
    description: "Gestiona compras y stock. Sin facturación ni precios de servicios.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      view_dashboard: true,
      view_purchases: true,
      manage_purchases: true,
      view_inventory: true,
      manage_inventory: true,
    },
  },
  {
    id: "manager",
    label: "Gerente / Encargado",
    description: "Acceso amplio incluyendo facturación, sin poder crear usuarios",
    permissions: {
      ...ALL_PERMISSIONS,
    },
  },
  {
    id: "readonly",
    label: "Solo lectura",
    description: "Puede ver todo pero no modificar nada",
    permissions: {
      ...EMPTY_PERMISSIONS,
      view_dashboard: true,
      view_patients: true,
      view_appointments: true,
      view_orders: true,
      view_schedule: true,
    },
  },
  {
    id: "custom",
    label: "Personalizado",
    description: "Configura permisos uno por uno",
    permissions: EMPTY_PERMISSIONS,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the user has the given permission.
 * Admins (permissions === null) always return true.
 */
export function hasPermission(
  permissions: CollaboratorPermissions | null | undefined,
  key: PermissionKey
): boolean {
  if (permissions === null || permissions === undefined) return true; // admin
  return !!permissions[key];
}

/**
 * Merges a partial permissions object with EMPTY_PERMISSIONS.
 * Safe to call with DB JSONB that may have partial keys (including DBs
 * written before BLOQUE 1.5 — missing new flags will default to false).
 */
export function normalizePermissions(
  raw: Partial<CollaboratorPermissions> | Record<string, unknown> | null | undefined
): CollaboratorPermissions {
  if (!raw || Object.keys(raw).length === 0) return { ...EMPTY_PERMISSIONS };
  return { ...EMPTY_PERMISSIONS, ...raw } as CollaboratorPermissions;
}

/**
 * Returns true if the user is a collaborator (role === 'collaborator').
 * Used to decide whether to apply permission checks.
 */
export function isCollaboratorRole(role: string | null | undefined): boolean {
  return role === "collaborator";
}

/**
 * Returns true if the user can see monetary amounts (prices, totals, subtotals).
 * Admins always can. Collaborators need view_prices OR view_billing_amounts.
 */
export function canViewPrices(permissions: CollaboratorPermissions | null | undefined): boolean {
  if (permissions === null || permissions === undefined) return true; // admin
  return !!permissions.view_prices || !!permissions.view_billing_amounts;
}

/** [BLOQUE 1.5] Manage billing = issue/edit/delete invoices (BLOQUE 3). */
export function canManageBilling(permissions: CollaboratorPermissions | null | undefined): boolean {
  if (permissions === null || permissions === undefined) return true;
  return !!permissions.manage_billing;
}

/** [BLOQUE 1.5] Manage pricing = catalog + per-client overrides (BLOQUE 4). */
export function canManagePricing(permissions: CollaboratorPermissions | null | undefined): boolean {
  if (permissions === null || permissions === undefined) return true;
  return !!permissions.manage_pricing;
}

/** [BLOQUE 1.5] Manage purchases (BLOQUE 6). */
export function canManagePurchases(permissions: CollaboratorPermissions | null | undefined): boolean {
  if (permissions === null || permissions === undefined) return true;
  return !!permissions.manage_purchases;
}

/** [BLOQUE 1.5] Manage inventory (BLOQUE 6). */
export function canManageInventory(permissions: CollaboratorPermissions | null | undefined): boolean {
  if (permissions === null || permissions === undefined) return true;
  return !!permissions.manage_inventory;
}

/** [BLOQUE 1.5] Edit existing orders. Distinct from create_orders. */
export function canEditOrders(permissions: CollaboratorPermissions | null | undefined): boolean {
  if (permissions === null || permissions === undefined) return true;
  return !!permissions.edit_orders;
}

// ─── 403 message helper ───────────────────────────────────────────────────────

/**
 * [BLOQUE 1.5] Build an actionable 403 message that names the missing flag.
 * Use this in API routes instead of generic "Sin permiso" strings.
 *
 * Example:
 *   if (isCollaboratorRole(role) && !hasPermission(permissions, "delete_orders")) {
 *     return NextResponse.json(
 *       { error: permissionDeniedMessage("delete_orders"), missing_flag: "delete_orders" },
 *       { status: 403 },
 *     );
 *   }
 */
export function permissionDeniedMessage(flag: PermissionKey): string {
  const label = PERMISSION_LABELS[flag];
  return `Acción bloqueada: te falta el permiso "${label}" (${flag}). Pedile a un admin que te lo asigne.`;
}

// ─── API payload sanitizer ────────────────────────────────────────────────────

/**
 * sanitizeInvoiceForCollaborator
 * [BLOQUE 1.5]
 *
 * Strips monetary fields from an invoice (and its order_items) when the
 * caller does NOT have the corresponding view flags. Goal: a fetched
 * payload must never leak amounts that the role is not allowed to see,
 * even via direct fetch bypassing the UI.
 *
 * Decision matrix:
 *   - Admin (permissions === null/undefined): no sanitization, return as-is.
 *   - Without `view_billing_amounts`: strip invoice-level monetary fields.
 *   - Without `view_prices`: strip item-level price fields.
 *   - When neither flag is present: also scrub free-text fields against
 *     common monetary number patterns (best-effort, not a hard barrier).
 *
 * Stripped invoice-level fields when !view_billing_amounts:
 *   MONETARY_FIELDS_INVOICE = total, subtotal, tax_amount, tax_rate
 *
 * Stripped item-level fields when !view_prices:
 *   MONETARY_FIELDS_ITEM = unit_price
 *   inside catalog_item: base_price
 *   inside selected_extras[]: price
 *
 * Free-text fields scrubbed (only when both flags are off):
 *   notes, description, patient_name, work_type
 *   Patterns: $1234.56, USD 100, AR$ 50, "1000 pesos", "100 dólares"
 *   Matches replaced with the literal "[monto oculto]".
 *
 * Always preserved: id, invoice_number, status, due_date, created_at,
 * delivery_date, organization names (lab_org/dentist_org), order_id,
 * patient_id, qty fields, tooth_positions, shade.
 *
 * NEW MONETARY FIELDS:
 *   When adding a new monetary column to invoices or to lab_order_items
 *   (or to selected_extras schema), you MUST update the constants below
 *   AND the per-item scrubbing inside this function. The constants are
 *   exported so unit tests can assert coverage.
 */

/** [BLOQUE 1.5] Top-level invoice fields hidden when caller lacks view_billing_amounts. */
export const MONETARY_FIELDS_INVOICE = ["total", "subtotal", "tax_amount", "tax_rate"] as const;

/** [BLOQUE 1.5] Item-level fields hidden when caller lacks view_prices. */
export const MONETARY_FIELDS_ITEM = ["unit_price"] as const;

/** [BLOQUE 1.5] Regex patterns considered monetary in free text. */
const MONEY_PATTERNS: RegExp[] = [
  /\$\s?[\d.,]+/g,                                              // $1,234.56  US$ 50  AR$ 50
  /\b(?:USD|US\$|ARS|AR\$|UYU|EUR|€|UR\$)\s?[\d.,]+/gi,         // USD 100, EUR 50
  /\b[\d.,]+\s?(?:pesos?|d[oó]lares?|usd|ars|euros?|uyu)\b/gi,  // 1000 pesos, 100 dólares
];

function scrubMonetaryText(text: string): string {
  let out = text;
  for (const re of MONEY_PATTERNS) out = out.replace(re, "[monto oculto]");
  return out;
}

interface SanitizableExtra { name: string; price?: number; qty?: number; [k: string]: unknown }
interface SanitizableItem {
  unit_price?: number | null;
  selected_extras?: SanitizableExtra[] | null;
  catalog_item?: { name?: string; base_price?: number; [k: string]: unknown } | null;
  [k: string]: unknown;
}
interface SanitizableInvoice {
  total?: number;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  notes?: string | null;
  description?: string | null;
  patient_name?: string | null;
  work_type?: string | null;
  order_items?: SanitizableItem[] | null;
  [k: string]: unknown;
}

export function sanitizeInvoiceForCollaborator<T extends SanitizableInvoice>(
  invoice: T,
  permissions: CollaboratorPermissions | null | undefined,
): T {
  // Admins → no sanitization
  if (permissions === null || permissions === undefined) return invoice;

  const canSeeAmounts = !!permissions.view_billing_amounts;
  const canSeePrices  = !!permissions.view_prices;
  if (canSeeAmounts && canSeePrices) return invoice;

  // Shallow clone — do not mutate the caller's reference
  const out: SanitizableInvoice = { ...invoice };

  if (!canSeeAmounts) {
    for (const key of MONETARY_FIELDS_INVOICE) delete out[key];
  }

  if (!canSeePrices && Array.isArray(out.order_items)) {
    out.order_items = out.order_items.map((it) => {
      const cleaned: SanitizableItem = { ...it };
      for (const key of MONETARY_FIELDS_ITEM) delete cleaned[key];
      if (cleaned.catalog_item) {
        const ci = { ...cleaned.catalog_item };
        delete ci.base_price;
        cleaned.catalog_item = ci;
      }
      if (Array.isArray(cleaned.selected_extras)) {
        cleaned.selected_extras = cleaned.selected_extras.map((e) => {
          const cleanedE: SanitizableExtra = { ...e };
          delete cleanedE.price;
          return cleanedE;
        });
      }
      return cleaned;
    });
  }

  // When both flags are off, also scrub free-text against monetary patterns
  if (!canSeeAmounts && !canSeePrices) {
    for (const key of ["notes", "description", "patient_name", "work_type"] as const) {
      const val = out[key];
      if (typeof val === "string" && val.length > 0) {
        out[key] = scrubMonetaryText(val);
      }
    }
  }

  return out as T;
}
