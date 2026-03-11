import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASSES } from "@/lib/order-status";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const colors = ORDER_STATUS_BADGE_CLASSES[status] || "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <Badge className={cn("px-3 py-0.5 text-xs font-bold uppercase border", colors, className)}>
      {label}
    </Badge>
  );
}
