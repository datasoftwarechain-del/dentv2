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

export const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  received: "bg-blue-100 text-blue-700 border-blue-200",
  missing_info: "bg-amber-100 text-amber-700 border-amber-200",
  in_production: "bg-purple-100 text-purple-700 border-purple-200",
  quality_check: "bg-orange-100 text-orange-700 border-orange-200",
  ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  delivered: "bg-accent/10 text-accent border-accent/20",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
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
  { id: "received", title: "Recibido", color: "bg-blue-500" },
  { id: "missing_info", title: "Falta Info", color: "bg-amber-500" },
  { id: "in_production", title: "En Produccion", color: "bg-purple-500" },
  { id: "quality_check", title: "Control Calidad", color: "bg-orange-500" },
  { id: "ready", title: "Listo", color: "bg-emerald-500" },
  { id: "delivered", title: "Entregado", color: "bg-accent" },
] as const;
