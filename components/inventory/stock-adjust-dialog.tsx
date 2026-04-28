"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowDownCircle, ArrowUpCircle, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export interface InventoryItemRow {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: InventoryItemRow | null;
  onSaved: () => void;
}

const TYPES = [
  { value: "in",     label: "Entrada",   icon: ArrowUpCircle,   accent: "text-emerald-600" },
  { value: "out",    label: "Salida",    icon: ArrowDownCircle, accent: "text-rose-600" },
  { value: "adjust", label: "Ajustar",   icon: Settings2,       accent: "text-amber-600" },
] as const;

export function StockAdjustDialog({ open, onOpenChange, item, onSaved }: Props) {
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("in");
    setQty("");
    setReason("");
  }, [open, item]);

  if (!item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    const q = parseFloat(qty);
    if (Number.isNaN(q) || q < 0) {
      toast.error("Cantidad inválida");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}/adjust`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          movement_type: type,
          quantity: q,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(`Stock actualizado: ${data.current_stock} ${item.unit}`);
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "No se pudo ajustar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Ajustar stock — {item.name}</DialogTitle>
          <DialogDescription>
            Stock actual: <strong>{item.current_stock} {item.unit}</strong> · Mínimo: {item.min_stock} {item.unit}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-semibold flex flex-col items-center gap-1 transition-colors",
                    type === t.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  <Icon className={cn("h-4 w-4", type === t.value && t.accent)} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-qty">
              {type === "adjust" ? `Stock final (en ${item.unit})` : `Cantidad (en ${item.unit})`}
            </Label>
            <Input
              id="sa-qty"
              type="number"
              min="0"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              autoFocus
            />
            {type === "adjust" && (
              <p className="text-[11px] text-muted-foreground">
                "Ajustar" reemplaza el stock actual con este valor exacto. Útil para inventarios físicos.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-reason">Motivo (opcional)</Label>
            <Textarea
              id="sa-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Recuento físico, daño, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
