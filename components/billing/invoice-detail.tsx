"use client";

import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Building2, User, Calendar, FileText, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
}

interface InvoiceDetailProps {
  invoice: {
    id: string;
    invoice_number: string;
    total: number;
    subtotal: number;
    tax_amount: number;
    status: string;
    due_date: string | null;
    created_at: string;
    patient_name?: string | null;
    work_type?: string | null;
    delivery_date?: string | null;
    notes?: string | null;
    dentist_org: Organization | null;
    lab_org: Organization | null;
  };
  isDentist: boolean;
  className?: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

export function InvoiceDetail({ invoice, isDentist, className }: InvoiceDetailProps) {
  return (
    <Card className={cn("border-2 shadow-lg bg-white", className)}>
      <CardContent className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">FACTURA</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Número de Factura: <span className="font-mono font-bold text-foreground">#{invoice.invoice_number}</span>
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-bold uppercase tracking-wider px-3 py-1",
              statusColors[invoice.status] || ""
            )}
          >
            {statusLabels[invoice.status] || invoice.status}
          </Badge>
        </div>

        <Separator />

        {/* Organizations Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <Building2 className="h-4 w-4" />
              {isDentist ? "Laboratorio" : "De"}
            </div>
            <div className="pl-6">
              <p className="font-bold text-lg">{invoice.lab_org?.name || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <Building2 className="h-4 w-4" />
              {isDentist ? "Clínica" : "Para"}
            </div>
            <div className="pl-6">
              <p className="font-bold text-lg">{invoice.dentist_org?.name || "N/A"}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Order Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Detalles del Trabajo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Name */}
            {invoice.patient_name && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Paciente</p>
                  <p className="font-semibold text-foreground">{invoice.patient_name}</p>
                </div>
              </div>
            )}

            {/* Work Type */}
            {invoice.work_type && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Tipo de Trabajo</p>
                  <p className="font-semibold text-foreground">{invoice.work_type}</p>
                </div>
              </div>
            )}

            {/* Delivery Date */}
            {invoice.delivery_date && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Fecha de Entrega</p>
                  <p className="font-semibold text-foreground">
                    {formatSimpleDate(invoice.delivery_date)}
                  </p>
                </div>
              </div>
            )}

            {/* Invoice Date */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Fecha de Emisión</p>
                <p className="font-semibold text-foreground">
                  {formatSimpleDate(invoice.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Amounts */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">${formatNumber(invoice.subtotal)}</span>
          </div>

          {invoice.tax_amount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-semibold">${formatNumber(invoice.tax_amount)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">TOTAL</span>
            <span className="text-2xl font-bold text-primary">
              ${formatNumber(invoice.total)}
            </span>
          </div>
        </div>

        {/* Due Date */}
        {invoice.due_date && invoice.status === "pending" && (
          <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-900">
                Vence el: {formatSimpleDate(invoice.due_date)}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-4 p-4 rounded-lg bg-muted/20 border border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Notas
            </p>
            <p className="text-sm text-foreground">{invoice.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
