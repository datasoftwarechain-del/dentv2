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
} from "lucide-react";
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
}

interface InvoiceActionsProps {
  invoice: Invoice;
  isDentist: boolean;
  balanceBefore?: number;
  balanceAfter?: number;
}

export function InvoiceActions({ invoice, isDentist, balanceBefore, balanceAfter }: InvoiceActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
