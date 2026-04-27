"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Search, Package, AlertTriangle, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatNumber } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { StockAdjustDialog, type InventoryItemRow } from "./stock-adjust-dialog";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

interface FullItem extends InventoryItemRow {
  unit_cost?: number;
  notes: string | null;
}

interface Props {
  /** [BLOQUE 6] manage_inventory. Drives create/edit/delete/adjust. */
  canManage?: boolean;
}

export function InventoryTable({ canManage = false }: Props) {
  const [items, setItems] = useState<FullItem[]>([]);
  const [canViewAmounts, setCanViewAmounts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editTarget, setEditTarget] = useState<FullItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit: "unidad",
    current_stock: "0",
    min_stock: "0",
    unit_cost: "0",
    notes: "",
  });

  const [adjustTarget, setAdjustTarget] = useState<InventoryItemRow | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FullItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al cargar stock");
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setCanViewAmounts(!!data.canViewAmounts);
    } catch (err: any) {
      toast.error(err.message || "No se pudo cargar el stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", unit: "unidad", current_stock: "0", min_stock: "0", unit_cost: "0", notes: "" });
    setEditOpen(true);
  }
  function openEdit(item: FullItem) {
    setEditTarget(item);
    setForm({
      name: item.name,
      unit: item.unit,
      current_stock: String(item.current_stock),
      min_stock: String(item.min_stock),
      unit_cost: item.unit_cost != null ? String(item.unit_cost) : "0",
      notes: item.notes ?? "",
    });
    setEditOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setEditLoading(true);
    try {
      const editing = !!editTarget;
      const url = editing ? `/api/inventory/${editTarget!.id}` : `/api/inventory`;
      const method = editing ? "PUT" : "POST";
      // En PUT no se envía current_stock — eso se cambia con el endpoint adjust.
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        unit: form.unit.trim() || "unidad",
        min_stock: parseFloat(form.min_stock) || 0,
        unit_cost: parseFloat(form.unit_cost) || 0,
        notes: form.notes.trim() || null,
      };
      if (!editing) payload.current_stock = parseFloat(form.current_stock) || 0;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(editing ? "Material actualizado" : "Material creado");
      setEditOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/inventory/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success("Material eliminado");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setDeleteLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q));
  }, [items, search]);

  const lowStockCount = items.filter((i) => Number(i.current_stock) < Number(i.min_stock)).length;
  const totalValue = canViewAmounts
    ? items.reduce((s, i) => s + (Number(i.current_stock) * Number(i.unit_cost ?? 0)), 0)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Stock de materiales
            </CardTitle>
            <CardDescription className="mt-1">
              Inventario de materiales del laboratorio. Ajustá stock con entradas, salidas o un valor fijo.
            </CardDescription>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="outline" className="font-bold text-xs border-[#09919b]/40 text-[#09919b]">
                Items: {items.length}
              </Badge>
              {lowStockCount > 0 && (
                <Badge variant="outline" className="font-bold text-xs border-amber-300 text-amber-700 bg-amber-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {lowStockCount} bajo mínimo
                </Badge>
              )}
              {canViewAmounts && (
                <span className="text-sm font-semibold text-[#044c64]">
                  Valor estimado:{" "}
                  <span className="tabular-nums text-[#09919b]">${formatNumber(totalValue)}</span>
                </span>
              )}
            </div>
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              className="bg-[#09919b] hover:bg-[#07667a] text-white shadow-md"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo material
            </Button>
          )}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {search.trim() ? "Sin coincidencias." : "Todavía no hay materiales registrados."}
          </p>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border/40">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Material</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stock actual</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mínimo</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Costo unit.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((item) => {
                  const low = Number(item.current_stock) < Number(item.min_stock);
                  return (
                    <tr key={item.id} className={cn("hover:bg-muted/20", low && "bg-amber-50/40")}>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {item.name}
                          {low && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              bajo mínimo
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{item.unit}</div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">
                        {formatNumber(item.current_stock)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {formatNumber(item.min_stock)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {canViewAmounts && item.unit_cost != null ? `$${formatNumber(item.unit_cost)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] border border-[#09919b]/30 text-[#09919b] hover:bg-[#09919b]/10"
                                onClick={() => { setAdjustTarget({ id: item.id, name: item.name, unit: item.unit, current_stock: item.current_stock, min_stock: item.min_stock }); setAdjustOpen(true); }}
                                title="Ajustar stock"
                              >
                                <Wrench className="h-3 w-3 mr-1" />
                                Ajustar
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(item)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(item)} title="Eliminar">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar material" : "Nuevo material"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Cambiar nombre, unidad, mínimo o costo. Para modificar el stock actual usá Ajustar."
                : "Registrar un nuevo material en el inventario."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="iv-name">Nombre *</Label>
              <Input id="iv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iv-unit">Unidad</Label>
                <Input id="iv-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unidad, gr, ml..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iv-min">Mínimo</Label>
                <Input id="iv-min" type="number" step="0.01" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {!editTarget && (
                <div className="space-y-2">
                  <Label htmlFor="iv-stock">Stock inicial</Label>
                  <Input id="iv-stock" type="number" step="0.01" min="0" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
                </div>
              )}
              <div className={cn("space-y-2", editTarget && "col-span-2")}>
                <Label htmlFor="iv-cost">Costo unitario</Label>
                <Input id="iv-cost" type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="iv-notes">Notas</Label>
              <Textarea id="iv-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editLoading} className="bg-primary hover:bg-primary/90">
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <StockAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        item={adjustTarget}
        onSaved={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar material?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también todos los movimientos asociados a {deleteTarget?.name}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
