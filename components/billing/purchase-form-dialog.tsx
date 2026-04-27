"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

const CATEGORY_OPTIONS = [
  { value: "materials", label: "Materiales" },
  { value: "equipment", label: "Equipamiento" },
  { value: "services",  label: "Servicios" },
  { value: "other",     label: "Otros" },
] as const;

export interface PurchaseRow {
  id: string;
  supplier_name: string;
  invoice_ref: string | null;
  total: number | null;
  purchase_date: string;
  category: string;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-loaded row when editing; null when creating. */
  initial: PurchaseRow | null;
  onSaved: () => void;
}

export function PurchaseFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const editing = !!initial;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    supplier_name: "",
    invoice_ref: "",
    total: "",
    purchase_date: new Date().toISOString().split("T")[0],
    category: "materials",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        supplier_name: initial.supplier_name,
        invoice_ref: initial.invoice_ref ?? "",
        total: initial.total != null ? String(initial.total) : "",
        purchase_date: initial.purchase_date,
        category: initial.category,
        notes: initial.notes ?? "",
      });
    } else {
      setForm({
        supplier_name: "",
        invoice_ref: "",
        total: "",
        purchase_date: new Date().toISOString().split("T")[0],
        category: "materials",
        notes: "",
      });
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplier_name.trim()) {
      toast.error("Nombre del proveedor es requerido");
      return;
    }
    const totalNum = parseFloat(form.total);
    if (Number.isNaN(totalNum) || totalNum < 0) {
      toast.error("Monto inválido");
      return;
    }
    setLoading(true);
    try {
      const url = editing ? `/api/purchases/${initial!.id}` : `/api/purchases`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          supplier_name: form.supplier_name.trim(),
          invoice_ref: form.invoice_ref.trim() || null,
          total: totalNum,
          purchase_date: form.purchase_date,
          category: form.category,
          notes: form.notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(editing ? "Compra actualizada" : "Compra registrada");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {editing ? "Editar compra" : "Registrar compra"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Actualizá los datos de esta compra."
              : "Registrá una compra a proveedor (materiales, equipamiento, etc.)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="pf-supplier">Proveedor *</Label>
            <Input
              id="pf-supplier"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              placeholder="Dental Supply S.A."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pf-date">Fecha *</Label>
              <Input
                id="pf-date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-category">Categoría</Label>
              <select
                id="pf-category"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pf-total">Monto *</Label>
              <Input
                id="pf-total"
                type="number"
                step="0.01"
                min="0"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-invref">Nº de factura proveedor</Label>
              <Input
                id="pf-invref"
                value={form.invoice_ref}
                onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })}
                placeholder="A-0001-12345"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pf-notes">Notas</Label>
            <Textarea
              id="pf-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Detalle, condiciones de pago, etc."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
