"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { UserPlus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AssignPatientButtonProps {
  orderId: string;
  patients: { id: string; first_name: string; last_name: string }[];
}

export function AssignPatientButton({ orderId, patients }: AssignPatientButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const options = patients.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }));

  async function handleSave() {
    if (!selectedPatientId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("lab_orders")
        .update({ patient_id: selectedPatientId })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Paciente asignado correctamente");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Error al asignar paciente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 group cursor-pointer"
        title="Asignar paciente"
      >
        <span className="font-bold text-sm text-muted-foreground group-hover:text-primary transition-colors">
          Sin paciente
        </span>
        <UserPlus className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[380px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Asignar paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Combobox
              options={options}
              value={selectedPatientId}
              onValueChange={setSelectedPatientId}
              placeholder="Seleccionar paciente..."
              searchPlaceholder="Buscar paciente..."
              emptyText="No se encontró el paciente."
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!selectedPatientId || loading}
                onClick={handleSave}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Asignar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
