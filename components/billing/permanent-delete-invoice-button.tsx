"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash, Loader2 } from "lucide-react";
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

interface PermanentDeleteInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal?: number;
  /** Optional callback after success (close parent dialog, etc.). */
  onDeleted?: () => void;
}

// [Sección 3] Hard-delete de factura (irreversible). Coexiste con
// "Anular factura" (soft-delete reversible). Diferencias:
//   - Anular  → mantiene fila en DB con invoice_voided_at, recuperable.
//   - Eliminar → borra fila + ledger movements 'charge'. NO recuperable.
//
// Solo lab con manage_billing puede ver el botón. Si la factura tiene
// pagos asociados, el endpoint devuelve 409 y el toast muestra el motivo.
export function PermanentDeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  invoiceTotal,
  onDeleted,
}: PermanentDeleteInvoiceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/permanent-delete`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar la factura");
      }
      toast.success(data.message || "Factura eliminada permanentemente");
      setOpen(false);
      onDeleted?.();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar la factura");
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
          className="h-9 px-3 font-bold text-xs border-destructive/60 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash className="mr-2 h-3.5 w-3.5" />
          )}
          Eliminar permanentemente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar factura {invoiceNumber} permanentemente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es irreversible. La factura se elimina de la base de datos por completo,
            junto con los movimientos del libro mayor asociados. ¿Continuar?
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
            <p className="text-xs text-destructive font-semibold">
              Para mantener trazabilidad histórica, considerá usar &quot;Anular factura&quot; en su lugar.
              Si la factura tiene pagos registrados, esta operación va a fallar — anulá los pagos primero.
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
            Eliminar permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
