"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { UserPlus, Loader2, Check, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AssignPatientButtonProps {
  orderId: string;
  dentistOrgId: string;
  patients: { id: string; first_name: string; last_name: string }[];
}

export function AssignPatientButton({ orderId, dentistOrgId, patients }: AssignPatientButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  // "select" | "create"
  const [mode, setMode] = useState<"select" | "create">("select");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");

  const options = patients.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }));

  function handleClose(open: boolean) {
    if (!open) {
      setSelectedPatientId("");
      setMode("select");
      setNewFirst("");
      setNewLast("");
    }
    setOpen(open);
  }

  async function handleAssign() {
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newFirst.trim() || !newLast.trim()) return;
    setLoading(true);
    try {
      const supabase = createClient();

      // 1. Crear el paciente
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          first_name: newFirst.trim(),
          last_name: newLast.trim(),
          dentist_org_id: dentistOrgId,
        })
        .select("id")
        .single();

      if (patientError) throw patientError;

      // 2. Asignarlo a la orden
      const { error: orderError } = await supabase
        .from("lab_orders")
        .update({ patient_id: newPatient.id })
        .eq("id", orderId);

      if (orderError) throw orderError;

      toast.success("Paciente creado y asignado correctamente");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Error al crear el paciente");
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

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[380px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {mode === "create" && (
                <button
                  onClick={() => setMode("select")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {mode === "select" ? "Asignar paciente" : "Nuevo paciente"}
            </DialogTitle>
          </DialogHeader>

          {mode === "select" ? (
            <div className="space-y-4 mt-2">
              <Combobox
                options={options}
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
                placeholder="Seleccionar paciente..."
                searchPlaceholder="Buscar paciente..."
                emptyText="No se encontró el paciente."
              />

              {/* Crear nuevo */}
              <button
                type="button"
                onClick={() => setMode("create")}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear nuevo paciente
              </button>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!selectedPatientId || loading}
                  onClick={handleAssign}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Check className="h-4 w-4 mr-1" />Asignar</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nombre</Label>
                <Input
                  value={newFirst}
                  onChange={(e) => setNewFirst(e.target.value)}
                  placeholder="Nombre"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Apellido</Label>
                <Input
                  value={newLast}
                  onChange={(e) => setNewLast(e.target.value)}
                  placeholder="Apellido"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newFirst.trim() || !newLast.trim() || loading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Check className="h-4 w-4 mr-1" />Crear y asignar</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
