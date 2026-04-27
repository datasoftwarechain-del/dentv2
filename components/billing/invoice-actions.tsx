"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceDetail } from "./invoice-detail";
import { DeleteInvoiceButton } from "./delete-invoice-button";
import {
  Eye,
  Download,
  FileText,
  Image as ImageIcon,
  Send,
  Mail,
  MessageCircle,
  MoreVertical,
  Loader2,
  Edit2,
  DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCSRF } from "@/hooks/useCSRF";
import { formatNumber } from "@/lib/date-utils";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  work_type: string;
  unit_price: number | null;
  quantity: number;
  selected_extras: { name: string; price: number; qty?: number }[];
  catalog_item: { name: string; base_price: number } | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  tax_rate?: number;
  status: string;
  due_date: string | null;
  created_at: string;
  patient_name?: string | null;
  work_type?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  dentist_org: Organization | null;
  lab_org: Organization | null;
  order_items?: OrderItem[];
  totals_strict?: boolean;
}

interface InvoiceActionsProps {
  invoice: Invoice;
  isDentist: boolean;
  balanceBefore?: number;
  balanceAfter?: number;
  /** [BLOQUE 3] true → render "Anular factura" button. Server-driven. */
  canManageBilling?: boolean;
}

export function InvoiceActions({ invoice, isDentist, balanceBefore, balanceAfter, canManageBilling = false }: InvoiceActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubtotal, setEditSubtotal] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const { csrfToken } = useCSRF();

  function openEdit() {
    const taxAmt = Number(invoice.tax_amount) || 0;
    const subtotalVal = taxAmt > 0 ? invoice.total - taxAmt : invoice.total;
    setEditSubtotal(subtotalVal.toFixed(2));
    setEditOpen(true);
  }

  async function handleSaveTotal(e: React.FormEvent) {
    e.preventDefault();
    const parsedSubtotal = parseFloat(editSubtotal) || 0;
    const taxAmt = Number(invoice.tax_amount) || 0;
    const taxRate = invoice.tax_rate || 0;
    const newTaxAmt = taxRate > 0 ? parseFloat((parsedSubtotal * taxRate / 100).toFixed(2)) : taxAmt;
    const newTotal = parseFloat((parsedSubtotal + newTaxAmt).toFixed(2));
    setEditLoading(true);
    try {
      const res = await fetch("/api/billing/update-invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ invoiceId: invoice.id, total: newTotal, subtotal: parsedSubtotal, tax_amount: newTaxAmt }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      toast.success("Factura actualizada");
      setEditOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setEditLoading(false);
    }
  }

  const invoiceWithBalance = { ...invoice, balanceBefore, balanceAfter };

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      const { exportInvoiceToPDF } = await import("@/lib/invoice-export");
      await exportInvoiceToPDF(invoiceWithBalance, isDentist);
      toast.success("PDF descargado correctamente");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportJPG() {
    setIsExporting(true);
    try {
      const { exportInvoiceToJPG } = await import("@/lib/invoice-export");
      await exportInvoiceToJPG(invoiceWithBalance, isDentist);
      toast.success("Imagen descargada correctamente");
    } catch (error) {
      console.error("Error exporting JPG:", error);
      toast.error("Error al exportar imagen");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSendEmail() {
    try {
      toast.info("Funcionalidad de email en desarrollo. Configure su servicio de email en la API.");

      // Descomentar cuando configures el servicio de email
      /*
      const response = await fetch("/api/billing/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          method: "email",
        }),
      });

      if (!response.ok) throw new Error("Failed to send email");

      toast.success("Factura enviada por email");
      */
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Error al enviar email");
    }
  }

  async function handleSendWhatsApp() {
    setIsExporting(true);
    try {
      const { generateInvoiceBlob } = await import("@/lib/invoice-export");
      const blob = await generateInvoiceBlob(invoiceWithBalance, isDentist);
      const fileName = `Factura_${invoice.invoice_number}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // Web Share API: abre el selector nativo (WhatsApp, etc.) en móvil y Chrome/Edge desktop
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Factura ${invoice.invoice_number}`,
          text: `Factura DigitalDent #${invoice.invoice_number}`,
        });
        // El usuario eligió la app — no hace falta toast
        return;
      }

      // Fallback desktop: copiar al portapapeles + descargar + abrir WhatsApp Web
      let copiedToClipboard = false;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        copiedToClipboard = true;
      } catch {
        // Portapapeles no disponible
      }

      // Descargar imagen
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Abrir WhatsApp Web
      window.open("https://web.whatsapp.com/", "_blank");

      if (copiedToClipboard) {
        toast.success(
          "Imagen copiada al portapapeles. En WhatsApp pega con Ctrl+V / Cmd+V",
          { duration: 8000 }
        );
      } else {
        toast.info(
          'Imagen descargada. En WhatsApp usa el clip para adjuntarla.',
          { duration: 8000 }
        );
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return; // Usuario canceló el share dialog
      console.error("Error al preparar WhatsApp:", error);
      toast.error("Error al generar la imagen de la factura");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* View Details Button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Ver
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Factura #{invoice.invoice_number}
            </DialogTitle>
            <DialogDescription>
              Detalles completos de la factura
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <InvoiceDetail
              invoice={invoice}
              isDentist={isDentist}
              balanceBefore={balanceBefore}
              balanceAfter={balanceAfter}
            />
          </div>

          {/* Edit + Delete buttons */}
          <div className="flex justify-end mt-4 gap-2">
            {/* [BLOQUE 3] Anular factura — solo lab con manage_billing. Histórica también puede anularse, pero el flujo es "anular + emitir nueva" sin modificar la histórica. */}
            {canManageBilling && !isDentist && (
              <DeleteInvoiceButton
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
                invoiceTotal={invoice.total}
                onDeleted={() => setDialogOpen(false)}
              />
            )}
            {invoice.totals_strict === false ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Esta factura no se puede modificar en montos. Si necesitás cambiar el monto, anulala y emití una nueva."
                className="border-[#b0dde0] text-[#044c64] font-semibold cursor-not-allowed"
              >
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                Editar factura
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={openEdit} className="border-[#b0dde0] text-[#044c64] hover:bg-[#f0fafb] font-semibold">
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                Editar factura
              </Button>
            )}
          </div>

          {/* Action buttons in dialog */}
          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex-1 min-w-[120px]"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Descargar PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJPG}
              disabled={isExporting}
              className="flex-1 min-w-[120px]"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              Descargar JPG
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              className="flex-1 min-w-[120px]"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSendEmail}
              className="flex-1 min-w-[120px]"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Factura #{invoice.invoice_number}</DialogTitle>
            <DialogDescription>Modificá el subtotal de la factura.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTotal} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="ia-subtotal">Subtotal</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ia-subtotal"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9 font-bold"
                  value={editSubtotal}
                  onChange={(e) => setEditSubtotal(e.target.value)}
                  required
                />
              </div>
            </div>
            {editSubtotal && !isNaN(parseFloat(editSubtotal)) && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                <div className="flex justify-between font-bold text-[#044c64]">
                  <span>Total</span>
                  <span>${formatNumber(parseFloat(editSubtotal) || 0)}</span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={editLoading} className="bg-primary hover:bg-primary/90">
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* More Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/10"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJPG} disabled={isExporting}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Exportar JPG
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSendWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSendEmail}>
            <Mail className="mr-2 h-4 w-4" />
            Enviar por Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
