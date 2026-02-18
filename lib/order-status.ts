export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  received: "Recibido",
  missing_info: "Falta Info",
  in_production: "En Produccion",
  quality_check: "Control Calidad",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

// Status colors derived from the DigitalDent brand palette
// #d2f2f3 (light teal) · #09919b (active) · #0d687d (deep) · #044c64 (primary)
// Indigo is color-wheel-adjacent to teal → used for "attention" states
// Emerald harmonizes with teal → used for "done" states
export const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  draft:         "bg-slate-50   text-slate-500   border-slate-200",
  received:      "bg-[#d2f2f3]  text-[#0d687d]   border-[#a8d8dc]",
  missing_info:  "bg-indigo-50  text-indigo-600  border-indigo-200",
  in_production: "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  quality_check: "bg-[#cce8ec]  text-[#0d687d]   border-[#9acfd4]",
  ready:         "bg-[#b0dde0]  text-[#044c64]    border-[#4b8899]",
  delivered:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:     "bg-slate-100  text-slate-500   border-slate-200",
};

export const ORDER_STATUS_ACTIVE = [
  "draft",
  "received",
  "missing_info",
  "in_production",
  "quality_check",
  "ready",
] as const;

export const ORDER_STATUS_KANBAN_COLUMNS = [
  { id: "received",      title: "Recibido",        color: "bg-[#4b8899]" },
  { id: "missing_info",  title: "Falta Info",       color: "bg-indigo-500" },
  { id: "in_production", title: "En Produccion",    color: "bg-[#09919b]" },
  { id: "quality_check", title: "Control Calidad",  color: "bg-[#0d687d]" },
  { id: "ready",         title: "Listo",            color: "bg-[#044c64]" },
  { id: "delivered",     title: "Entregado",        color: "bg-emerald-600" },
] as const;

export const ORDER_STATUS_GROUPS = {
  active: ["draft", "received", "missing_info", "in_production", "quality_check"],
  completed: ["ready", "delivered"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
} as const;
