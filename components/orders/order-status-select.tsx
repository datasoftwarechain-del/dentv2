"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";

const EDITABLE_STATUSES = [
  { value: "received",      label: "Recibido",       dot: "bg-[#0d687d]" },
  { value: "in_production", label: "En Producción",  dot: "bg-[#09919b]" },
  { value: "ready",         label: "Listo",          dot: "bg-[#044c64]" },
  { value: "delivered",     label: "Entregado",      dot: "bg-emerald-500" },
  { value: "cancelled",     label: "Cancelado",      dot: "bg-slate-400" },
] as const;

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface OrderStatusSelectProps {
  orderId: string;
  currentStatus: string;
  canUpdate: boolean;
}

export function OrderStatusSelect({
  orderId,
  currentStatus,
  canUpdate,
}: OrderStatusSelectProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);

  if (!canUpdate) {
    return <StatusBadge status={status} />;
  }

  const current = EDITABLE_STATUSES.find((s) => s.value === status);

  async function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar");
      }
      setStatus(newStatus);
      toast.success("Estado actualizado");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar el estado");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={updating}>
      <SelectTrigger className="h-7 w-auto min-w-[130px] border border-border/40 rounded-lg px-2.5 gap-1.5 bg-background hover:bg-muted/20 focus:ring-1 focus:ring-primary/20 transition-colors shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {updating ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", current?.dot ?? "bg-slate-300")} />
          )}
          <span className="text-xs font-semibold truncate">
            {current?.label ?? status}
          </span>
        </div>
        <SelectValue className="hidden" />
      </SelectTrigger>
      <SelectContent className="min-w-[170px] rounded-xl p-1 shadow-lg border border-border/50">
        {EDITABLE_STATUSES.map((s) => (
          <SelectItem
            key={s.value}
            value={s.value}
            className="rounded-lg cursor-pointer focus:bg-muted/50 data-[state=checked]:bg-muted/40"
          >
            <div className="flex items-center gap-2.5 py-0.5">
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.dot)} />
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
