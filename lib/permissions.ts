/**
 * Collaborator permission system for DigitalDent v2.
 *
 * Admins always have full access (permissions field is empty {}).
 * Collaborators have explicit boolean flags controlling what they can see/do.
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
  view_prices: boolean;          // See service prices in orders & catalog
  view_billing_amounts: boolean; // See monetary amounts in billing page

  // ── Actions (what the user can do inside allowed sections) ──
  create_orders: boolean;
  update_order_status: boolean;
  create_appointments: boolean;  // Dentist only
  create_patients: boolean;      // Dentist only
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
  "create_orders",
  "update_order_status",
  "create_appointments",
  "create_patients",
] as const satisfies (keyof CollaboratorPermissions)[];

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Labels for each permission (used in the settings UI) */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_dashboard:        "Ver dashboard principal",
  view_patients:         "Ver pacientes",
  view_appointments:     "Ver citas",
  view_orders:           "Ver órdenes",
  view_cases:            "Ver casos digitales",
  view_schedule:         "Ver agenda semanal",
  view_kanban:           "Ver tablero de producción",
  view_billing:          "Ver facturación",
  view_clients:          "Ver clínicas / clientes",
  view_prices:           "Ver precios de servicios",
  view_billing_amounts:  "Ver montos en facturación",
  create_orders:         "Crear órdenes",
  update_order_status:   "Cambiar estado de órdenes",
  create_appointments:   "Crear citas",
  create_patients:       "Agregar pacientes",
};

/** Which sections apply to which org type */
export const DENTIST_PERMISSIONS: PermissionKey[] = [
  "view_dashboard", "view_patients", "view_appointments", "view_orders",
  "view_cases", "view_schedule", "view_billing",
  "view_prices", "view_billing_amounts",
  "create_orders", "update_order_status", "create_appointments", "create_patients",
];

export const LAB_PERMISSIONS: PermissionKey[] = [
  "view_dashboard", "view_orders", "view_cases", "view_schedule",
  "view_kanban", "view_billing", "view_clients",
  "view_prices", "view_billing_amounts",
  "create_orders", "update_order_status",
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
    ],
  },
  {
    label: "Información financiera",
    description: "Acceso a precios y montos monetarios",
    keys: ["view_prices", "view_billing_amounts"],
  },
  {
    label: "Acciones permitidas",
    description: "Qué puede crear o modificar",
    keys: [
      "create_orders", "update_order_status",
      "create_appointments", "create_patients",
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
  create_orders: false,
  update_order_status: false,
  create_appointments: false,
  create_patients: false,
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
  create_orders: true,
  update_order_status: true,
  create_appointments: true,
  create_patients: true,
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
 * Safe to call with DB JSONB that may have partial keys, or with a full CollaboratorPermissions object.
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
