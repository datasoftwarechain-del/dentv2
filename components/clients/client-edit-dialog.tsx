"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Phone, Mail, MapPin, Building2, CreditCard, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";
import { useCSRF } from "@/hooks/useCSRF";

interface ClientEditDialogProps {
  clientId: string;
  initialData: {
    phone: string;
    email: string;
    address: string;
    city: string;
    tax_id: string;
    notes: string;
  };
}

export function ClientEditDialog({ clientId, initialData }: ClientEditDialogProps) {
  const router = useRouter();
  const { csrfToken } = useCSRF();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialData);

  function handleChange(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      toast.success("Información actualizada correctamente");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  const fields: { key: keyof typeof form; label: string; icon: any; placeholder: string; type?: string; multiline?: boolean }[] = [
    { key: "phone", label: "Teléfono", icon: Phone, placeholder: "Ej: +56 9 1234 5678" },
    { key: "email", label: "Email", icon: Mail, placeholder: "contacto@clinica.com", type: "email" },
    { key: "address", label: "Dirección", icon: MapPin, placeholder: "Ej: Av. Providencia 1234" },
    { key: "city", label: "Ciudad", icon: Building2, placeholder: "Ej: Santiago" },
    { key: "tax_id", label: "RUT / ID Fiscal", icon: CreditCard, placeholder: "Ej: 12.345.678-9" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-md">
          <Pencil className="mr-2 h-4 w-4" />
          Editar información
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Editar Información de Contacto
          </DialogTitle>
          <DialogDescription>
            Actualiza los datos de contacto de esta clínica
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label, icon: Icon, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Label>
                <Input
                  type={type || "text"}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  className="bg-background border-input h-9 text-sm focus:border-primary transition-all"
                />
              </div>
            ))}
          </div>

          {/* Notes takes full width */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Notas internas
            </Label>
            <Textarea
              placeholder="Notas privadas sobre este cliente (solo visibles para tu laboratorio)..."
              value={form.notes}
              onChange={e => handleChange("notes", e.target.value)}
              className="resize-none min-h-[80px] bg-background border-input text-sm focus:border-primary transition-all"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="hover:bg-muted">
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
