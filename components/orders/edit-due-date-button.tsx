"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatSimpleDate } from "@/lib/date-utils";
import { useCSRF } from "@/hooks/useCSRF";

interface EditDueDateButtonProps {
  orderId: string;
  currentDueDate: string | null;
}

export function EditDueDateButton({ orderId, currentDueDate }: EditDueDateButtonProps) {
  const router = useRouter();
  const { csrfToken } = useCSRF();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const parsedDate = currentDueDate ? new Date(currentDueDate) : null;
  const initialDate = parsedDate ? parsedDate.toISOString().split("T")[0] : "";
  const initialTime = parsedDate ? parsedDate.toTimeString().slice(0, 5) : "18:00";

  const [dueDate, setDueDate] = useState(initialDate);
  const [dueTime, setDueTime] = useState(initialTime);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/orders/update-due-date", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ orderId, dueDate: dueDate || null, dueTime }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al actualizar");

      toast.success("Fecha de entrega actualizada");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la fecha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 group cursor-pointer"
        title="Editar fecha de entrega"
      >
        <span className="font-bold text-sm group-hover:text-primary transition-colors">
          {currentDueDate ? formatSimpleDate(currentDueDate) : "No especificada"}
        </span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[360px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Cambiar fecha de entrega</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Fecha</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Hora de entrega</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => { setDueDate(""); setDueTime("18:00"); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Quitar fecha
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Check className="h-4 w-4 mr-1" />Guardar</>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
