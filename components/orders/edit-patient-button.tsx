"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Pencil, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface EditPatientButtonProps {
  orderId: string;
  currentPatientId: string | null;
  currentPatientName: string | null;
  dentistOrgId: string;
}

export function EditPatientButton({
  orderId,
  currentPatientId,
  currentPatientName,
  dentistOrgId,
}: EditPatientButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patients, setPatients] = useState<{ value: string; label: string }[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(currentPatientId || "");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPatientsLoading(true);
    const supabase = createClient();
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("dentist_org_id", dentistOrgId)
      .order("first_name")
      .then(({ data }) => {
        if (!cancelled) {
          setPatients(
            (data || []).map((p) => ({
              value: p.id,
              label: `${p.first_name} ${p.last_name}`,
            }))
          );
          setPatientsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [open, dentistOrgId]);

  async function handleSave() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("lab_orders")
        .update({ patient_id: selectedPatientId || null })
        .eq("id", orderId);

      if (error) throw error;
      toast.success("Paciente actualizado");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar el paciente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 group cursor-pointer"
        title="Editar paciente"
      >
        <span className="font-bold text-sm group-hover:text-primary transition-colors">
          {currentPatientName || "Sin paciente"}
        </span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[360px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Cambiar paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {patientsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando pacientes...
              </div>
            ) : (
              <Combobox
                options={patients}
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
                placeholder="Seleccionar paciente"
                searchPlaceholder="Buscar paciente..."
                emptyText="No se encontraron pacientes."
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={loading || patientsLoading}
                onClick={handleSave}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
