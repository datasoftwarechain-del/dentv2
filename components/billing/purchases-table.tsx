"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Search, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
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
import { formatNumber, formatSimpleDate } from "@/lib/date-utils";
import { PurchaseFormDialog, type PurchaseRow } from "./purchase-form-dialog";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

const CATEGORY_LABELS: Record<string, string> = {
  materials: "Materiales",
  equipment: "Equipamiento",
  services:  "Servicios",
  other:     "Otros",
};

const CATEGORY_COLORS: Record<string, string> = {
  materials: "bg-[#d2f2f3] text-[#0d687d] border-[#a8d8dc]",
  equipment: "bg-amber-50 text-amber-700 border-amber-200",
  services:  "bg-violet-50 text-violet-700 border-violet-200",
  other:     "bg-muted text-muted-foreground border-border",
};

interface Props {
  /** [BLOQUE 6] manage_purchases. Drives create/edit/delete buttons. */
  canManage?: boolean;
}

export function PurchasesTable({ canManage = false }: Props) {
  const [items, setItems] = useState<PurchaseRow[]>([]);
  const [canViewAmounts, setCanViewAmounts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al cargar compras");
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setCanViewAmounts(!!data.canViewAmounts);
    } catch (err: any) {
      toast.error(err.message || "No se pudo cargar compras");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.supplier_name.toLowerCase().includes(q) ||
        (i.invoice_ref ?? "").toLowerCase().includes(q) ||
        CATEGORY_LABELS[i.category]?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalPeriod = useMemo(
    () => (canViewAmounts ? filtered.reduce((s, i) => s + Number(i.total ?? 0), 0) : 0),
    [filtered, canViewAmounts],
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/purchases/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      toast.success("Compra eliminada");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Compras
            </CardTitle>
            <CardDescription className="mt-1">
              Compras a proveedores: materiales, equipamiento, servicios.
            </CardDescription>
            {canViewAmounts && (
              <p className="text-sm font-semibold text-[#044c64] mt-2">
                Total visible:{" "}
                <span className="tabular-nums text-[#09919b]">${formatNumber(totalPeriod)}</span>
              </p>
            )}
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              className="bg-[#09919b] hover:bg-[#07667a] text-white shadow-md"
              onClick={() => { setEditTarget(null); setDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva compra
            </Button>
          )}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, factura o categoría..."
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
            {search.trim() ? "Ninguna compra coincide con la búsqueda." : "Todavía no hay compras registradas."}
          </p>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border/40">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Proveedor</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoría</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Factura</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      {formatSimpleDate(p.purchase_date)}
                    </td>
                    <td className="px-4 py-2 font-semibold text-foreground">{p.supplier_name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={CATEGORY_COLORS[p.category] ?? "border-border"}>
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">
                      {p.invoice_ref ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {canViewAmounts && p.total != null ? `$${formatNumber(p.total)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => { setEditTarget(p); setDialogOpen(true); }}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(p)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <PurchaseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editTarget}
        onSaved={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es definitiva. La compra de {deleteTarget?.supplier_name} desaparecerá del listado.
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
