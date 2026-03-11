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

const EDITABLE_STATUSES = [
  { value: "received",    label: "Recibido" },
  { value: "in_progress", label: "En Curso" },
  { value: "ready",       label: "Listo" },
  { value: "delivered",   label: "Entregado" },
  { value: "cancelled",   label: "Cancelado" },
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
    <div className="flex items-center gap-2">
      {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Select value={status} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-auto gap-2 border-border/60 bg-background text-xs font-medium pr-2 focus:ring-1 focus:ring-primary/30">
          <SelectValue>
            <StatusBadge status={status} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <StatusBadge status={s.value} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
