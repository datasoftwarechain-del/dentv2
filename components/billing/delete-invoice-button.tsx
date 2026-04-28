"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
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
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface DeleteInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  /** May be undefined for collaborators without view_billing_amounts. */
  invoiceTotal?: number;
  /** Optional callback after success (close parent dialog, etc.). */
  onDeleted?: () => void;
}

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  invoiceTotal,
  onDeleted,
}: DeleteInvoiceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error al anular la factura");
      }
      toast.success(data.message || "Factura anulada correctamente");
      setOpen(false);
      onDeleted?.();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "No se pudo anular la factura");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 font-bold text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-3.5 w-3.5" />
          )}
          Anular factura
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular factura {invoiceNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta factura será marcada como anulada (soft-delete). Va a desaparecer de los listados,
            pero queda en la base de datos como referencia histórica. Los movimientos del libro mayor
            asociados (cargo de alta) se eliminarán y se recalculará el balance del cliente.
          </AlertDialogDescription>
          <div className="space-y-2 text-sm pt-2">
            <p className="text-xs text-muted-foreground">
              Número: <strong className="text-foreground">{invoiceNumber}</strong>
              {invoiceTotal !== undefined && (
                <>
                  {" · "}Monto: <strong className="text-foreground">${formatNumber(invoiceTotal)}</strong>
                </>
              )}
            </p>
            <p className="text-xs text-amber-700">
              Si la factura tiene pagos registrados, la operación va a fallar — primero hay que reversar
              los pagos. Para emitir una factura nueva, se hace manualmente; el trigger automático no
              la va a regenerar para esta orden (Caso C).
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Anular
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
