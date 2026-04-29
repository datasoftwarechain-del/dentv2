"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatNumber } from "@/lib/date-utils";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  persistedTotal: number;
  recomputedTotal: number;
  /** true = la factura tiene ajuste manual; sync usa ?force=true y dialog reforzado. */
  manuallyOverridden?: boolean;
  onSynced?: () => void;
}

/**
 * [BLOQUE 8] Sync invoice persisted totals with the current items.
 * Solves the snapshot-vs-live drift: the trigger emits the invoice
 * with item state at the moment of emission, but the user can edit
 * items afterwards. This button repulls the totals from the CURRENT
 * items and updates the persisted columns. Also marks the invoice as
 * totals_strict=true so future edits via update-invoice work normally.
 */
export function SyncInvoiceButton({
  invoiceId,
  invoiceNumber,
  persistedTotal,
  recomputedTotal,
  manuallyOverridden = false,
  onSynced,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const qs = manuallyOverridden ? "?force=true" : "";
      const res = await fetch(
        `/api/billing/invoices/${invoiceId}/sync-from-items${qs}`,
        {
          method: "POST",
          headers: { "x-csrf-token": getCsrfToken() },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al sincronizar");
      toast.success(
        `Factura ${invoiceNumber} sincronizada · Total $${formatNumber(data.total ?? recomputedTotal)}`,
      );
      setOpen(false);
      onSynced?.();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "No se pudo sincronizar");
    } finally {
      setLoading(false);
    }
  }

  const diff = recomputedTotal - persistedTotal;
  const diffSign = diff >= 0 ? "+" : "−";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 font-bold text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
          disabled={loading}
          title="Recalcular el total a partir de los ítems actuales y guardar"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          Sincronizar con ítems
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {manuallyOverridden
              ? `Sobrescribir ajuste manual de ${invoiceNumber}`
              : `¿Sincronizar factura ${invoiceNumber} con ítems?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {manuallyOverridden
              ? "Esta factura tiene un ajuste manual. Sincronizar va a reemplazar el total cobrado por el recálculo desde ítems y el flag de ajuste manual quedará limpio."
              : "El subtotal y total persistidos en la factura se van a recalcular a partir de los ítems actuales de la orden (incluyendo extras × cantidad)."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 text-sm pt-2">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/40 p-3 bg-muted/20">
            <div>
              <p className="text-[11px] uppercase font-bold text-muted-foreground">
                {manuallyOverridden ? "Ajuste manual actual" : "Persistido actual"}
              </p>
              <p className="text-lg font-bold tabular-nums text-slate-700">${formatNumber(persistedTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-muted-foreground">Nuevo total</p>
              <p className="text-lg font-bold tabular-nums text-[#09919b]">${formatNumber(recomputedTotal)}</p>
            </div>
            <div className="col-span-2 pt-1 border-t border-border/30">
              <p className="text-[11px] uppercase font-bold text-muted-foreground">Diferencia</p>
              <p className={`text-base font-bold tabular-nums ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {diffSign}${formatNumber(Math.abs(diff))}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Después del sync la factura queda marcada como{" "}
            <code className="font-mono text-[10px]">totals_strict=true</code>
            {manuallyOverridden ? (
              <>
                {" "}y <code className="font-mono text-[10px]">manually_overridden=false</code>
              </>
            ) : null}
            . El balance del cliente se recalcula automáticamente.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleSync(); }}
            disabled={loading}
            className={manuallyOverridden ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {manuallyOverridden ? "Sobrescribir ajuste" : "Sincronizar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
