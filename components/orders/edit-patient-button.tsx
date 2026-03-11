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
import { createClient } from "@/lib/supabase/client";

interface EditPatientButtonProps {
  patientId: string;
  firstName: string;
  lastName: string;
}

export function EditPatientButton({
  patientId,
  firstName,
  lastName,
}: EditPatientButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);

  function handleOpen() {
    setFirst(firstName);
    setLast(lastName);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("patients")
        .update({ first_name: first.trim(), last_name: last.trim() })
        .eq("id", patientId);

      if (error) throw error;
      toast.success("Nombre del paciente actualizado");
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
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 group cursor-pointer"
        title="Editar nombre del paciente"
      >
        <span className="font-bold text-sm group-hover:text-primary transition-colors">
          {firstName} {lastName}
        </span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[360px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar nombre del paciente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nombre</Label>
              <Input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="Nombre"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Apellido</Label>
              <Input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="Apellido"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
