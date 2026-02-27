export const ORDER_STATUS_LABELS: Record<string, string> = {
  // ── Simplified 4-state workflow ──────────────────────────────────────────
  received:    "Recibido",
  in_progress: "En Curso",
  ready:       "Listo",
  delivered:   "Entregado",
  // ── Legacy values (backward compat for existing DB records) ──────────────
  draft:         "Recibido",
  missing_info:  "En Curso",
  in_production: "En Curso",
  quality_check: "En Curso",
  cancelled:     "Cancelado",
};

// Status colors — DigitalDent brand palette
export const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  received:    "bg-[#d2f2f3]  text-[#0d687d]   border-[#a8d8dc]",
  in_progress: "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  ready:       "bg-[#b0dde0]  text-[#044c64]   border-[#4b8899]",
  delivered:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  // Legacy mappings
  draft:         "bg-[#d2f2f3]  text-[#0d687d]   border-[#a8d8dc]",
  missing_info:  "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  in_production: "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  quality_check: "bg-[#e0f4f6]  text-[#09919b]   border-[#b0dde0]",
  cancelled:     "bg-slate-100  text-slate-500   border-slate-200",
};

export const ORDER_STATUS_ACTIVE = [
  "received",
  "in_progress",
  "ready",
  // Legacy active statuses
  "draft",
  "missing_info",
  "in_production",
  "quality_check",
] as const;

export const ORDER_STATUS_KANBAN_COLUMNS = [
  { id: "received",      title: "Recibido",  color: "bg-[#4b8899]" },
  { id: "in_production", title: "En Curso",  color: "bg-[#09919b]" },
  { id: "ready",         title: "Listo",     color: "bg-[#044c64]" },
  { id: "delivered",     title: "Entregado", color: "bg-emerald-600" },
] as const;

export const ORDER_STATUS_GROUPS = {
  active:    ["received", "in_progress", "ready", "draft", "missing_info", "in_production", "quality_check"],
  completed: ["ready", "delivered"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
} as const;

// Pie chart segment colors — DigitalDent brand palette
export const STATUS_PIE_COLORS: Record<string, string> = {
  received:      "#d2f2f3",
  in_progress:   "#09919b",
  ready:         "#b0dde0",
  delivered:     "#43eada",
  // Legacy DB values
  draft:         "#d2f2f3",
  missing_info:  "#09919b",
  in_production: "#09919b",
  quality_check: "#09919b",
  cancelled:     "#94a3b8",
};
