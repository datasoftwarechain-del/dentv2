"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { useCSRF } from "@/hooks/useCSRF";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, TrendingUp, TrendingDown, Calendar, Edit2, Trash2, DollarSign, Loader2, User, Percent, Download, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { formatWorkType } from "@/lib/work-types";
import { InvoiceDetail } from "./invoice-detail";

interface Organization {
  id: string;
  name: string;
}

interface OrderItem {
  id?: string;
  catalog_item: { name: string; base_price: number } | null;
  work_type: string;
  unit_price?: number | null;
  quantity?: number;
  selected_extras?: { name: string; price: number; qty?: number }[];
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  tax_amount: number;
  status: string;
  created_at: string;
  order_id?: string | null;
  patient_name?: string | null;
  work_type?: string | null;
  order_items?: OrderItem[];
}

interface LedgerMovement {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface UnifiedTransaction {
  id: string;
  date: string;
  type: "invoice" | "payment" | "charge";
  description: string;
  patient_name?: string | null;
  debit: number; // Cargo (factura)
  credit: number; // Abono (pago)
  balance: number;
  status?: string;
  has_tax?: boolean;
  order_id?: string | null;
}

interface UnifiedAccountStatementProps {
  invoices: Invoice[];
  movements: LedgerMovement[];
  isDentist: boolean;
  initialBalance?: number;
  organizationId: string;
  clientId: string;
  clientName?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  paid: "bg-secondary/[0.10] text-secondary hover:bg-secondary/[0.14]",
};

export function UnifiedAccountStatement({
  invoices,
  movements,
  isDentist,
  initialBalance = 0,
  organizationId,
  clientId,
  clientName = "Cliente",
}: UnifiedAccountStatementProps) {
  const router = useRouter();
  const { csrfToken } = useCSRF();
  const [sortAsc, setSortAsc] = useState(false); // false = más reciente primero
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editInvoiceDialogOpen, setEditInvoiceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewInvoiceOpen, setViewInvoiceOpen] = useState(false);
  const [viewInvoiceData, setViewInvoiceData] = useState<{ invoice: Invoice; balanceBefore: number; balanceAfter: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<LedgerMovement | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: "",
    description: "",
    date: "",
  });
  const [editInvoiceFormData, setEditInvoiceFormData] = useState({
    subtotal: "",
    patient_name: "",
    work_type: "",
    applyIva: false,
    ivaRate: "10",
  });

  // Crear transacciones unificadas
  const transactions: UnifiedTransaction[] = [];

  // Agregar facturas como cargos
  invoices.forEach((inv) => {
    transactions.push({
      id: inv.id,
      date: inv.created_at,
      type: "invoice",
      description: `Factura ${inv.invoice_number}${
        inv.order_items?.[0]?.catalog_item?.name
          ? ` (${inv.order_items[0].catalog_item.name})`
          : inv.work_type ? ` (${formatWorkType(inv.work_type)})` : ""
      }`,
      patient_name: inv.patient_name,
      debit: Number(inv.total), // Cargo
      credit: 0,
      balance: 0, // Se calculará después
      status: inv.status,
      has_tax: Number(inv.tax_amount) > 0,
      order_id: inv.order_id || null,
    });
  });

  // Agregar movimientos
  movements.forEach((mov) => {
    const isCharge = mov.type === "charge";
    transactions.push({
      id: mov.id,
      date: mov.created_at,
      type: mov.type as "payment" | "charge",
      description: mov.description || (isCharge ? "Cargo adicional" : "Pago recibido"),
      debit: isCharge ? Number(mov.amount) : 0,
      credit: !isCharge ? Number(mov.amount) : 0,
      balance: 0, // Se calculará después
    });
  });

  // PASO 1: Ordenar cronológicamente de más antiguo a más reciente (para calcular balance correcto)
  transactions.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    // Ordenar por fecha primero (ascendente - más antiguo primero)
    if (dateA !== dateB) {
      return dateA - dateB;
    }

    // Si las fechas son iguales, las facturas van primero (para que el balance tenga sentido)
    if (a.type === "invoice" && b.type !== "invoice") {
      return -1; // factura va primero
    }
    if (a.type !== "invoice" && b.type === "invoice") {
      return 1; // factura va primero
    }

    // Si ambos son del mismo tipo, ordenar por ID
    return a.id.localeCompare(b.id);
  });

  // PASO 2: Calcular balance continuo (en orden cronológico)
  let runningBalance = initialBalance;
  transactions.forEach((t) => {
    runningBalance += t.debit - t.credit;
    t.balance = runningBalance;
  });

  const finalBalance = runningBalance;

  // PASO 3: Aplicar orden elegido por el usuario (no mutamos — spread)
  const sortedTransactions = sortAsc ? [...transactions] : [...transactions].reverse();

  // PASO 4: Filtrar por rango de fechas
  const filteredTransactions = sortedTransactions.filter((t) => {
    if (dateFrom && new Date(t.date) < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo   && new Date(t.date) > new Date(dateTo   + "T23:59:59")) return false;
    return true;
  });

  // Funciones para editar/eliminar movimientos
  function handleEditClick(movement: LedgerMovement) {
    setSelectedMovement(movement);
    setEditFormData({
      amount: movement.amount.toString(),
      description: movement.description || "",
      date: new Date(movement.created_at).toISOString().split('T')[0],
    });
    setEditDialogOpen(true);
  }

  function handleEditInvoiceClick(invoice: Invoice) {
    setSelectedInvoice(invoice);
    const taxAmt = Number(invoice.tax_amount) || 0;
    const hasTax = taxAmt > 0;
    const subtotalVal = hasTax ? invoice.total - taxAmt : invoice.total;
    const computedRate = hasTax && subtotalVal > 0
      ? Math.round(taxAmt / subtotalVal * 100).toString()
      : "10";
    setEditInvoiceFormData({
      subtotal: subtotalVal.toFixed(2),
      patient_name: invoice.patient_name || "",
      work_type: invoice.work_type || "",
      applyIva: hasTax,
      ivaRate: computedRate,
    });
    setEditInvoiceDialogOpen(true);
  }

  function handleDeleteClick(movement: LedgerMovement) {
    setSelectedMovement(movement);
    setDeleteDialogOpen(true);
  }

  async function handleUpdateMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMovement) return;

    setLoading(true);
    try {
      const response = await fetch("/api/billing/update-movement", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          movementId: selectedMovement.id,
          amount: parseFloat(editFormData.amount),
          description: editFormData.description,
          date: editFormData.date,
          organizationId,
          clientId,
          isDentist,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al actualizar");

      toast.success("Movimiento actualizado correctamente");
      setEditDialogOpen(false);
      router.refresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar movimiento");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;

    const parsedSubtotal = parseFloat(editInvoiceFormData.subtotal) || 0;
    const parsedIvaRate  = editInvoiceFormData.applyIva ? parseFloat(editInvoiceFormData.ivaRate) || 10 : 0;
    const parsedIvaAmt   = editInvoiceFormData.applyIva ? parseFloat((parsedSubtotal * parsedIvaRate / 100).toFixed(2)) : 0;
    const parsedTotal    = parseFloat((parsedSubtotal + parsedIvaAmt).toFixed(2));

    setLoading(true);
    try {
      const response = await fetch("/api/billing/update-invoice", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          total: parsedTotal,
          subtotal: parsedSubtotal,
          tax_rate: parsedIvaRate,
          tax_amount: parsedIvaAmt,
          patient_name: editInvoiceFormData.patient_name,
          work_type: editInvoiceFormData.work_type,
          organizationId,
          clientId,
          isDentist,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al actualizar");

      toast.success("Factura actualizada correctamente");
      setEditInvoiceDialogOpen(false);
      router.refresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar factura");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMovement() {
    if (!selectedMovement) return;

    setLoading(true);
    try {
      const response = await fetch("/api/billing/delete-movement", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          movementId: selectedMovement.id,
          organizationId,
          clientId,
          isDentist,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al eliminar");

      toast.success("Movimiento eliminado correctamente");
      setDeleteDialogOpen(false);
      router.refresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar movimiento");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      const { exportAccountStatementToPDF } = await import("@/lib/account-statement-export");
      await exportAccountStatementToPDF({
        transactions: filteredTransactions,
        clientName,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        finalBalance,
      });
      toast.success("PDF descargado correctamente");
    } catch {
      toast.error("Error al generar el PDF");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card className="border border-slate-200 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-100 pb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-[17px] font-bold text-slate-900">Estado de Cuenta Unificado</CardTitle>
            <CardDescription className="text-[12px] font-medium text-slate-500 mt-1">
              Historial completo de facturas y pagos en orden cronológico
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting || filteredTransactions.length === 0}
            className="shrink-0 h-9 gap-1.5 font-semibold text-xs"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar PDF
          </Button>
        </div>

        {/* Date range filter */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-full sm:w-auto rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-full sm:w-auto rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="h-8 text-xs text-slate-500 hover:text-slate-700"
            >
              Limpiar filtro
            </Button>
          )}
          {(dateFrom || dateTo) && (
            <span className="text-[11px] text-slate-400">
              {filteredTransactions.length} de {sortedTransactions.length} movimientos
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedTransactions.length > 0 ? (
          <>
          {/* ── Desktop table — oculta en móvil ─────────────────────────────── */}
          <div className="hidden sm:block overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 cursor-pointer select-none hover:text-slate-900 transition-colors"
                    onClick={() => setSortAsc((v) => !v)}
                  >
                    <div className="flex items-center gap-1">
                      Fecha
                      {sortAsc
                        ? <ArrowUp className="h-3 w-3 text-primary" />
                        : <ArrowDown className="h-3 w-3 text-primary" />}
                    </div>
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Descripción</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Paciente</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Cargo</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Abono</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Balance</TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      No hay movimientos en el período seleccionado
                    </TableCell>
                  </TableRow>
                ) : null}
                {filteredTransactions.map((transaction, index) => (
                  <TableRow
                    key={`${transaction.type}-${transaction.id}-${index}`}
                    className="border-border/40 hover:bg-slate-50/80 transition-all duration-150"
                  >
                    <TableCell className="font-medium text-[13px]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-700">{formatSimpleDate(transaction.date)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-2">
                        {transaction.type === "invoice" ? (
                          <FileText className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        ) : transaction.debit > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-secondary00/70 flex-shrink-0" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium text-slate-800 leading-snug">{transaction.description}</span>
                            {transaction.has_tax && (
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">IVA</span>
                            )}
                          </div>
                          {transaction.type === "invoice" && transaction.order_id && (
                            <Link
                              href={`/dashboard/orders/${transaction.order_id}`}
                              className="text-[11px] text-primary/70 hover:text-primary hover:underline font-medium transition-colors w-fit"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver orden →
                            </Link>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {transaction.patient_name ? (
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-[13px] text-slate-700">{transaction.patient_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {transaction.debit > 0 ? (
                        <span className="text-[14px] font-semibold text-slate-800">
                          +${formatNumber(transaction.debit)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {transaction.credit > 0 ? (
                        <span className="text-[14px] font-semibold text-secondary">
                          −${formatNumber(transaction.credit)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={cn(
                        "text-[14px] font-bold tracking-tight",
                        transaction.balance > 0 ? "text-slate-900" : transaction.balance < 0 ? "text-secondary" : "text-slate-600"
                      )}>
                        ${formatNumber(Math.abs(transaction.balance))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        {transaction.type === "invoice" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-[#d2f2f3] hover:text-[#0d687d] transition-colors"
                              title="Ver factura"
                              onClick={() => {
                                const invoice = invoices.find(inv => inv.id === transaction.id);
                                if (invoice) {
                                  setViewInvoiceData({
                                    invoice,
                                    balanceBefore: transaction.balance - transaction.debit,
                                    balanceAfter: transaction.balance,
                                  });
                                  setViewInvoiceOpen(true);
                                }
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              onClick={() => {
                                const invoice = invoices.find(inv => inv.id === transaction.id);
                                if (invoice) handleEditInvoiceClick(invoice);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              onClick={() => {
                                const movement = movements.find(m => m.id === transaction.id);
                                if (movement) handleEditClick(movement);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              onClick={() => {
                                const movement = movements.find(m => m.id === transaction.id);
                                if (movement) handleDeleteClick(movement);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60 border-t-2 border-slate-200">
                  <TableCell colSpan={3} className="text-right font-semibold uppercase text-[11px] tracking-wider text-slate-600 py-4">
                    Totales
                  </TableCell>
                  <TableCell className="text-right text-[14px] font-bold text-slate-800 tabular-nums py-4">
                    ${formatNumber(filteredTransactions.reduce((sum, t) => sum + t.debit, 0))}
                  </TableCell>
                  <TableCell className="text-right text-[14px] font-bold text-secondary tabular-nums py-4">
                    ${formatNumber(filteredTransactions.reduce((sum, t) => sum + t.credit, 0))}
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex items-center justify-end gap-2">
                      <span className={cn(
                        "text-[15px] font-extrabold tabular-nums tracking-tight",
                        finalBalance > 0 ? "text-slate-900" : finalBalance < 0 ? "text-secondary" : "text-slate-600"
                      )}>
                        ${formatNumber(Math.abs(finalBalance))}
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-[7px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                        finalBalance > 0 ? "bg-blue-50/80 text-blue-700 border-blue-300/60" : "bg-secondary/[0.08] text-secondary border-secondary/20"
                      )}>
                        {finalBalance > 0 ? "A Cobrar" : finalBalance < 0 ? "A Favor" : "Saldado"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="py-4"></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* ── Mobile card list — oculta en desktop ─────────────────────────── */}
          <div className="sm:hidden divide-y divide-slate-100">
            {filteredTransactions.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No hay movimientos en el período seleccionado</p>
            ) : filteredTransactions.map((transaction, index) => (
              <div key={`m-${transaction.type}-${transaction.id}-${index}`} className="px-4 py-4">

                {/* Fila 1: Fecha + Monto */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="text-[12px] font-medium text-slate-500">{formatSimpleDate(transaction.date)}</span>
                  </div>
                  <div>
                    {transaction.debit > 0 ? (
                      <span className="text-[15px] font-bold text-slate-800 tabular-nums">+${formatNumber(transaction.debit)}</span>
                    ) : (
                      <span className="text-[15px] font-bold text-secondary tabular-nums">−${formatNumber(transaction.credit)}</span>
                    )}
                  </div>
                </div>

                {/* Fila 2: Descripción */}
                <div className="flex items-start gap-2 mb-3">
                  {transaction.type === "invoice" ? (
                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-[1px]" />
                  ) : transaction.debit > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-[1px]" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-secondary00 shrink-0 mt-[1px]" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-slate-700 leading-snug">{transaction.description}</span>
                      {transaction.has_tax && (
                        <span className="shrink-0 text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">IVA</span>
                      )}
                    </div>
                    {transaction.type === "invoice" && transaction.order_id && (
                      <Link
                        href={`/dashboard/orders/${transaction.order_id}`}
                        className="text-[11px] text-primary/70 hover:text-primary hover:underline font-medium transition-colors w-fit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver orden →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Fila 3: Paciente + Saldo + Acciones */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {transaction.patient_name ? (
                      <>
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-[11px] text-slate-500 truncate">{transaction.patient_name}</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-300">Sin paciente</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn(
                      "text-[11px] font-bold tabular-nums mr-1",
                      transaction.balance > 0 ? "text-slate-600" : transaction.balance < 0 ? "text-secondary" : "text-slate-400"
                    )}>
                      Saldo: ${formatNumber(Math.abs(transaction.balance))}
                    </span>
                    {transaction.type === "invoice" ? (
                      <>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-[#d2f2f3] hover:text-[#0d687d] transition-colors"
                          title="Ver factura"
                          onClick={() => {
                            const invoice = invoices.find(inv => inv.id === transaction.id);
                            if (invoice) {
                              setViewInvoiceData({
                                invoice,
                                balanceBefore: transaction.balance - transaction.debit,
                                balanceAfter: transaction.balance,
                              });
                              setViewInvoiceOpen(true);
                            }
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          onClick={() => {
                            const invoice = invoices.find(inv => inv.id === transaction.id);
                            if (invoice) handleEditInvoiceClick(invoice);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          onClick={() => {
                            const movement = movements.find(m => m.id === transaction.id);
                            if (movement) handleEditClick(movement);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          onClick={() => {
                            const movement = movements.find(m => m.id === transaction.id);
                            if (movement) handleDeleteClick(movement);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Mobile totals footer ─────────────────────────────────────────── */}
          {filteredTransactions.length > 0 && (
            <div className="sm:hidden border-t-2 border-slate-200 bg-slate-50/60 px-4 py-4 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-slate-500">Total Cargos:</span>
                  <span className="font-bold text-slate-800 tabular-nums">
                    ${formatNumber(filteredTransactions.reduce((s, t) => s + t.debit, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-slate-500">Total Abonos:</span>
                  <span className="font-bold text-secondary tabular-nums">
                    ${formatNumber(filteredTransactions.reduce((s, t) => s + t.credit, 0))}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Balance Final</p>
                <p className={cn(
                  "text-[22px] font-extrabold tabular-nums tracking-tight leading-none mb-1",
                  finalBalance > 0 ? "text-slate-900" : finalBalance < 0 ? "text-secondary" : "text-slate-500"
                )}>
                  ${formatNumber(Math.abs(finalBalance))}
                </p>
                <Badge variant="outline" className={cn(
                  "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                  finalBalance > 0 ? "bg-blue-50/80 text-blue-700 border-blue-300/60" : "bg-secondary/[0.08] text-secondary border-secondary/20"
                )}>
                  {finalBalance > 0 ? "A Cobrar" : finalBalance < 0 ? "A Favor" : "Saldado"}
                </Badge>
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="py-16 text-center">
            <FileText className="h-14 w-14 text-slate-300 mx-auto mb-4" />
            <p className="text-[13px] font-medium text-slate-500">No hay transacciones registradas</p>
            <p className="text-[11px] text-slate-400 mt-1">Las facturas y pagos aparecerán aquí</p>
          </div>
        )}

      </CardContent>

      {/* View Invoice Dialog */}
      <Dialog open={viewInvoiceOpen} onOpenChange={setViewInvoiceOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Factura {viewInvoiceData?.invoice.invoice_number}</DialogTitle>
            <DialogDescription>Detalle de la factura</DialogDescription>
          </DialogHeader>
          {viewInvoiceData && (
            <InvoiceDetail
              invoice={{
                ...viewInvoiceData.invoice,
                subtotal: viewInvoiceData.invoice.total - viewInvoiceData.invoice.tax_amount,
                dentist_org: null,
                lab_org: null,
                due_date: null,
                order_items: (viewInvoiceData.invoice.order_items || []).map((item) => ({
                  id: item.id ?? "",
                  work_type: item.work_type,
                  unit_price: item.unit_price ?? null,
                  quantity: item.quantity ?? 1,
                  selected_extras: item.selected_extras ?? [],
                  catalog_item: item.catalog_item
                    ? { name: item.catalog_item.name, base_price: item.catalog_item.base_price }
                    : null,
                })),
              }}
              isDentist={isDentist}
              balanceBefore={viewInvoiceData.balanceBefore}
              balanceAfter={viewInvoiceData.balanceAfter}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Movement Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Editar Movimiento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modifica los datos del movimiento contable
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateMovement} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Fecha</Label>
              <Input
                id="edit-date"
                type="date"
                className="bg-background focus:border-primary"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Monto</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-9 bg-background focus:border-primary font-bold"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Input
                id="edit-description"
                placeholder="Descripción del movimiento"
                className="bg-background focus:border-primary"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditDialogOpen(false)}
                className="hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={editInvoiceDialogOpen} onOpenChange={setEditInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[440px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Editar Factura</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modifica el monto, IVA y detalles de la factura
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateInvoice} className="space-y-5 mt-4">
            {/* Subtotal */}
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-subtotal">Subtotal</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-invoice-subtotal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-9 bg-background focus:border-primary font-bold"
                  value={editInvoiceFormData.subtotal}
                  onChange={(e) => setEditInvoiceFormData({ ...editInvoiceFormData, subtotal: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* IVA toggle */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary/70" />
                  <span className="text-sm font-semibold">Aplicar IVA</span>
                  <span className="text-[10px] text-muted-foreground">(opcional)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditInvoiceFormData({ ...editInvoiceFormData, applyIva: !editInvoiceFormData.applyIva })}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                    editInvoiceFormData.applyIva ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                    editInvoiceFormData.applyIva ? "translate-x-4" : "translate-x-1"
                  )} />
                </button>
              </div>
              {editInvoiceFormData.applyIva && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-invoice-iva" className="text-xs text-muted-foreground">
                    Porcentaje de IVA (mínimo 10%)
                  </Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-invoice-iva"
                      type="number"
                      step="0.5"
                      min="10"
                      max="100"
                      placeholder="10"
                      className="pl-9 bg-background focus:border-primary font-bold"
                      value={editInvoiceFormData.ivaRate}
                      onChange={(e) => setEditInvoiceFormData({ ...editInvoiceFormData, ivaRate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Total preview */}
            {editInvoiceFormData.subtotal && !isNaN(parseFloat(editInvoiceFormData.subtotal)) && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${formatNumber(parseFloat(editInvoiceFormData.subtotal) || 0)}</span>
                </div>
                {editInvoiceFormData.applyIva && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA ({editInvoiceFormData.ivaRate || 10}%)</span>
                    <span>
                      ${formatNumber((parseFloat(editInvoiceFormData.subtotal) || 0) * (parseFloat(editInvoiceFormData.ivaRate) || 10) / 100)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-primary/20 pt-1.5 text-primary">
                  <span>Total</span>
                  <span>
                    ${formatNumber(
                      (parseFloat(editInvoiceFormData.subtotal) || 0) +
                      (editInvoiceFormData.applyIva
                        ? (parseFloat(editInvoiceFormData.subtotal) || 0) * (parseFloat(editInvoiceFormData.ivaRate) || 10) / 100
                        : 0)
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Patient & Work Type */}
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-patient">Paciente</Label>
              <Input
                id="edit-invoice-patient"
                placeholder="Nombre del paciente"
                className="bg-background focus:border-primary"
                value={editInvoiceFormData.patient_name}
                onChange={(e) => setEditInvoiceFormData({ ...editInvoiceFormData, patient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-work">Tipo de Trabajo</Label>
              <Input
                id="edit-invoice-work"
                placeholder="Ej: Corona, Carilla, etc."
                className="bg-background focus:border-primary"
                value={editInvoiceFormData.work_type}
                onChange={(e) => setEditInvoiceFormData({ ...editInvoiceFormData, work_type: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditInvoiceDialogOpen(false)}
                className="hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Movement Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-border bg-background/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-600">
              ¿Eliminar movimiento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción no se puede deshacer. El movimiento será eliminado permanentemente y los balances se recalcularán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMovement}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
