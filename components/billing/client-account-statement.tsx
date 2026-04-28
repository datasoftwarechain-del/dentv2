"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoiceActions } from "./invoice-actions";
import { UnifiedAccountStatement } from "./unified-account-statement";
import {
  Building2,
  DollarSign,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Calendar,
  User,
  Package,
  Plus,
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

import { formatWorkType, WORK_TYPE_LABELS } from "@/lib/work-types";
import { logger } from "@/lib/logger";

interface Organization {
  id: string;
  name: string;
  email?: string;
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

interface LedgerMovement {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface ClientAccountStatementProps {
  client: Organization;
  invoices: Invoice[];
  movements: LedgerMovement[];
  isDentist: boolean;
  balance: number;
  totalInvoiced: number;
  totalPaid: number;
  organizationId: string;
  isReadOnly?: boolean;
  /** [BLOQUE 3] Forwarded to InvoiceActions to render "Anular factura". */
  canManageBilling?: boolean;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  pending:   "bg-[#d2f2f3] text-[#4b8899] border-[#a8d8dc] hover:bg-[#d2f2f3]",
  paid:      "bg-secondary/[0.08] text-secondary border-secondary/20 hover:bg-secondary/[0.12]",
  overdue:   "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-50",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100",
};

export function ClientAccountStatement({
  client,
  invoices,
  movements,
  isDentist,
  balance,
  totalInvoiced,
  totalPaid,
  organizationId,
  isReadOnly = false,
  canManageBilling = false,
}: ClientAccountStatementProps) {
  const router = useRouter();
  const { csrfToken } = useCSRF();
  const [activeTab, setActiveTab] = useState<"account" | "invoices" | "movements">("account");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"invoice_number" | "patient_name" | "work_type" | "delivery_date" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
  });
  const [adjustFormData, setAdjustFormData] = useState({
    targetBalance: "",
    description: "",
  });

  const [createInvoiceDialogOpen, setCreateInvoiceDialogOpen] = useState(false);
  const [createInvoiceLoading, setCreateInvoiceLoading] = useState(false);
  const [createInvoiceForm, setCreateInvoiceForm] = useState({
    patientName: "",
    workType: "",
    subtotal: "",
    applyIva: false,
    ivaRate: "10",
    dueDate: "",
    notes: "",
  });

  // Compute per-invoice running balances (interleaving invoices + movements chronologically)
  const invoiceBalances = React.useMemo(() => {
    const events = [
      ...invoices.map(inv => ({ date: inv.created_at, kind: "invoice" as const, id: inv.id, amount: Number(inv.total) })),
      ...movements.map(mov => ({ date: mov.created_at, kind: (mov.type === "charge" ? "charge" as const : "payment" as const), id: mov.id, amount: Number(mov.amount) })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const map: Record<string, { before: number; after: number }> = {};
    let running = 0;
    for (const e of events) {
      const prev = running;
      if (e.kind === "invoice" || e.kind === "charge") running += e.amount;
      else running -= e.amount;
      if (e.kind === "invoice") map[e.id] = { before: prev, after: running };
    }
    return map;
  }, [invoices, movements]);

  // Función para ordenar
  function handleSort(field: "invoice_number" | "patient_name" | "work_type" | "delivery_date") {
    if (sortField === field) {
      // Si ya está ordenado por este campo, cambiar dirección
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Nuevo campo, ordenar descendente por defecto
      setSortField(field);
      setSortDirection("desc");
    }
  }

  // Filtrar y ordenar facturas
  const filteredAndSortedInvoices = React.useMemo(() => {
    let result = [...invoices];

    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(query) ||
        inv.patient_name?.toLowerCase().includes(query) ||
        inv.work_type?.toLowerCase().includes(query)
      );
    }

    // Ordenar
    if (sortField) {
      result.sort((a, b) => {
        let aVal: any = a[sortField];
        let bVal: any = b[sortField];

        // Manejar valores nulos
        if (!aVal) return 1;
        if (!bVal) return -1;

        // Comparar según el tipo
        if (sortField === "delivery_date") {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        } else {
          // Para invoice_number, patient_name, work_type - comparar como texto
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [invoices, searchQuery, sortField, sortDirection]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/billing/record-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          organizationId,
          clientId: client.id,
          amount: formData.amount,
          description: formData.description || `Cobro registrado para ${client.name}`,
          date: formData.date,
          isDentist,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar cobro");
      }

      logger.log("Cobro registrado:", data);

      setDialogOpen(false);
      setFormData({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0]
      });
      toast.success("Cobro registrado correctamente");

      // Recargar la página para ver los cambios
      router.refresh();

      // Esperar un momento y recargar si no se actualizó
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      logger.error("Error completo:", err);
      toast.error(err.message || "Error al registrar cobro");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    setAdjustLoading(true);
    try {
      const response = await fetch("/api/billing/adjust-balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          organizationId,
          clientId: client.id,
          targetBalance: adjustFormData.targetBalance,
          description: adjustFormData.description || "Ajuste manual de saldo",
          isDentist,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al ajustar saldo");
      setAdjustDialogOpen(false);
      setAdjustFormData({ targetBalance: "", description: "" });
      toast.success("Saldo ajustado correctamente");
      router.refresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Error al ajustar saldo");
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    const subtotal = parseFloat(createInvoiceForm.subtotal) || 0;
    const ivaRate = createInvoiceForm.applyIva ? parseFloat(createInvoiceForm.ivaRate) || 10 : 0;
    const ivaAmount = createInvoiceForm.applyIva ? parseFloat((subtotal * ivaRate / 100).toFixed(2)) : 0;
    const total = parseFloat((subtotal + ivaAmount).toFixed(2));

    setCreateInvoiceLoading(true);
    try {
      const response = await fetch("/api/billing/manual-invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          dentistOrgId: client.id,
          patientName: createInvoiceForm.patientName || null,
          workType: createInvoiceForm.workType || null,
          total,
          dueDate: createInvoiceForm.dueDate || null,
          notes: createInvoiceForm.notes || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al crear factura");

      toast.success("Factura creada correctamente");
      setCreateInvoiceDialogOpen(false);
      setCreateInvoiceForm({ patientName: "", workType: "", subtotal: "", applyIva: false, ivaRate: "10", dueDate: "", notes: "" });
      router.refresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Error al crear factura");
    } finally {
      setCreateInvoiceLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard/billing")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Facturación
      </Button>

      {/* Client Info Card */}
      <Card className="border-2 border-primary/20 shadow-lg bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-bold">{client.name}</CardTitle>
              </div>
              {client.email && (
                <CardDescription className="text-sm">
                  {client.email}
                </CardDescription>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold uppercase tracking-wider px-3 py-1",
                balance > 0 ? "bg-[#d2f2f3] text-[#0d687d] border-[#a8d8dc]" : "bg-secondary/[0.08] text-secondary border-secondary/20"
              )}
            >
              {balance > 0 ? "Con Saldo Pendiente" : "Al Día"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Total Facturado
            </p>
            <div className="p-2 rounded-xl bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              ${formatNumber(totalInvoiced)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
              {invoices.length} facturas
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Total Pagado
            </p>
            <div className="p-2 rounded-xl bg-secondary/[0.10]">
              <CheckCircle className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-secondary">
              ${formatNumber(totalPaid)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
              {movements.filter(m => m.type === "payment").length} cobros
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/30 shadow-premium bg-gradient-to-br from-primary/5 to-background">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
              Saldo Actual
            </p>
            <div className="flex items-center gap-1.5">
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setAdjustFormData({ targetBalance: String(balance), description: "" });
                    setAdjustDialogOpen(true);
                  }}
                  className="p-1.5 rounded-lg hover:bg-primary/15 transition-colors group"
                  title="Ajustar saldo manualmente"
                >
                  <Pencil className="h-3.5 w-3.5 text-primary/60 group-hover:text-primary transition-colors" />
                </button>
              )}
              <div className="p-2 rounded-xl bg-primary/20">
                <Clock className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-bold tracking-tight",
              balance > 0 ? "text-[#09919b]" : balance < 0 ? "text-secondary" : "text-foreground"
            )}>
              ${formatNumber(Math.abs(balance))}
            </div>
            <p className="text-[10px] font-semibold mt-2">
              {balance > 0 ? (
                <span className="text-[#09919b]">· A cobrar</span>
              ) : balance < 0 ? (
                <span className="text-secondary">✓ A favor del cliente</span>
              ) : (
                <span className="text-muted-foreground">✓ Saldo en cero</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                Ajustar Saldo
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Saldo actual: <span className="font-bold text-foreground">${formatNumber(Math.abs(balance))}</span>
                {balance > 0 ? " (a cobrar)" : balance < 0 ? " (a favor)" : ""}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdjustBalance} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="adjust-target">Nuevo saldo</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="adjust-target"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-9 bg-background focus:border-primary font-bold"
                    value={adjustFormData.targetBalance}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, targetBalance: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-desc">Motivo</Label>
                <Input
                  id="adjust-desc"
                  placeholder="Ej: Saldo inicial, corrección contable..."
                  className="bg-background focus:border-primary"
                  value={adjustFormData.description}
                  onChange={(e) => setAdjustFormData({ ...adjustFormData, description: e.target.value })}
                />
              </div>
              {adjustFormData.targetBalance && !isNaN(parseFloat(adjustFormData.targetBalance)) && (
                <div className="rounded-lg bg-muted/50 border border-border/60 px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Saldo actual</span>
                    <span className="font-semibold text-foreground">${formatNumber(Math.abs(balance))}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Ajuste</span>
                    <span className={cn(
                      "font-semibold",
                      parseFloat(adjustFormData.targetBalance) > balance ? "text-red-600" : "text-secondary"
                    )}>
                      {parseFloat(adjustFormData.targetBalance) >= balance ? "+" : ""}
                      ${formatNumber(Math.abs(parseFloat(adjustFormData.targetBalance) - balance))}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border/60 pt-1 mt-1">
                    <span>Nuevo saldo</span>
                    <span className="text-primary">${formatNumber(parseFloat(adjustFormData.targetBalance))}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="ghost" onClick={() => setAdjustDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={adjustLoading} className="bg-primary hover:bg-primary/90">
                  {adjustLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ajustar Saldo
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      {/* Tabs with Register Payment Button */}
      <div className="flex justify-between items-center border-b">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setActiveTab("account")}
            className={cn(
              "rounded-b-none transition-colors",
              activeTab === "account"
                ? "bg-slate-100 text-slate-900 hover:bg-slate-100"
                : "hover:bg-muted"
            )}
          >
            <FileText className="mr-2 h-4 w-4" />
            Estado de Cuenta
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab("invoices")}
            className={cn(
              "rounded-b-none transition-colors",
              activeTab === "invoices"
                ? "bg-slate-100 text-slate-900 hover:bg-slate-100"
                : "hover:bg-muted"
            )}
          >
            <FileText className="mr-2 h-4 w-4" />
            Facturas
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab("movements")}
            className={cn(
              "rounded-b-none transition-colors",
              activeTab === "movements"
                ? "bg-slate-100 text-slate-900 hover:bg-slate-100"
                : "hover:bg-muted"
            )}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Movimientos
          </Button>
        </div>

        {/* Register Payment Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {!isReadOnly && (
            <DialogTrigger asChild>
              <Button className="font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                Registrar {isDentist ? "Pago" : "Cobro"}
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-[425px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                Registrar {isDentist ? "Pago" : "Cobro"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Registra un movimiento contable para {client.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-foreground">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  className="bg-background focus:border-primary transition-all"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-foreground">Monto</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-9 bg-background focus:border-primary transition-all font-bold"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Descripción</Label>
                <Input
                  id="description"
                  placeholder="Ej: Pago factura #1024"
                  className="bg-background focus:border-primary transition-all"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  className="hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Registrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Unified Account Statement */}
      {activeTab === "account" && (
        <UnifiedAccountStatement
          invoices={invoices}
          movements={movements}
          isDentist={isDentist}
          initialBalance={0}
          organizationId={organizationId}
          clientId={client.id}
          clientName={client.name}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Invoices Table */}
      {activeTab === "invoices" && (
        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="shrink-0">
                <CardTitle className="text-lg font-bold">Historial de Facturas</CardTitle>
                <CardDescription className="text-xs font-medium">
                  Todas las facturas emitidas para este cliente
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por paciente, trabajo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
                {/* Only labs can create manual invoices */}
                {!isDentist && (
                  <Button
                    onClick={() => setCreateInvoiceDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider shrink-0"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nueva Factura
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Create Invoice Dialog */}
          <Dialog open={createInvoiceDialogOpen} onOpenChange={setCreateInvoiceDialogOpen}>
            <DialogContent className="sm:max-w-[460px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                  Nueva Factura Manual
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Crea una factura para {client.name} sin necesidad de una orden
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateInvoice} className="space-y-4 mt-3">
                {/* Patient */}
                <div className="space-y-2">
                  <Label htmlFor="ci-patient">Paciente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="ci-patient"
                    placeholder="Nombre del paciente"
                    className="bg-background focus:border-primary"
                    value={createInvoiceForm.patientName}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, patientName: e.target.value })}
                  />
                </div>

                {/* Work Type */}
                <div className="space-y-2">
                  <Label htmlFor="ci-work">Tipo de Trabajo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <select
                    id="ci-work"
                    value={createInvoiceForm.workType}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, workType: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  >
                    <option value="">— Sin especificar —</option>
                    {Object.entries(WORK_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Subtotal */}
                <div className="space-y-2">
                  <Label htmlFor="ci-subtotal">Subtotal <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ci-subtotal"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="pl-9 bg-background focus:border-primary font-bold"
                      value={createInvoiceForm.subtotal}
                      onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, subtotal: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* IVA toggle */}
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-primary/70" />
                      <span className="text-sm font-semibold">Aplicar IVA</span>
                      <span className="text-[10px] text-muted-foreground">(opcional)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateInvoiceForm({ ...createInvoiceForm, applyIva: !createInvoiceForm.applyIva })}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                        createInvoiceForm.applyIva ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                        createInvoiceForm.applyIva ? "translate-x-4" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                  {createInvoiceForm.applyIva && (
                    <div className="space-y-1.5">
                      <Label htmlFor="ci-iva" className="text-xs text-muted-foreground">Porcentaje IVA (mínimo 10%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="ci-iva"
                          type="number"
                          step="0.5"
                          min="10"
                          max="100"
                          placeholder="10"
                          className="pl-9 bg-background focus:border-primary font-bold"
                          value={createInvoiceForm.ivaRate}
                          onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, ivaRate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Total preview */}
                {createInvoiceForm.subtotal && !isNaN(parseFloat(createInvoiceForm.subtotal)) && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>${formatNumber(parseFloat(createInvoiceForm.subtotal) || 0)}</span>
                    </div>
                    {createInvoiceForm.applyIva && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>IVA ({createInvoiceForm.ivaRate || 10}%)</span>
                        <span>${formatNumber((parseFloat(createInvoiceForm.subtotal) || 0) * (parseFloat(createInvoiceForm.ivaRate) || 10) / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t border-primary/20 pt-1.5 text-primary">
                      <span>Total</span>
                      <span>${formatNumber(
                        (parseFloat(createInvoiceForm.subtotal) || 0) +
                        (createInvoiceForm.applyIva ? (parseFloat(createInvoiceForm.subtotal) || 0) * (parseFloat(createInvoiceForm.ivaRate) || 10) / 100 : 0)
                      )}</span>
                    </div>
                  </div>
                )}

                {/* Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="ci-due">Fecha de Vencimiento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="ci-due"
                    type="date"
                    className="bg-background focus:border-primary"
                    value={createInvoiceForm.dueDate}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, dueDate: e.target.value })}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="ci-notes">Notas <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="ci-notes"
                    placeholder="Observaciones adicionales..."
                    className="bg-background focus:border-primary"
                    value={createInvoiceForm.notes}
                    onChange={(e) => setCreateInvoiceForm({ ...createInvoiceForm, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setCreateInvoiceDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createInvoiceLoading} className="bg-primary hover:bg-primary/90">
                    {createInvoiceLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear Factura
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <CardContent>
            {invoices.length > 0 ? (
              <>
              {/* ── Desktop table ── */}
              <div className="hidden sm:block rounded-2xl border border-border/40 overflow-hidden bg-background/30">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead
                        className="text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleSort("invoice_number")}
                      >
                        <div className="flex items-center gap-1">
                          Factura
                          {sortField === "invoice_number" ? (
                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleSort("patient_name")}
                      >
                        <div className="flex items-center gap-1">
                          Paciente
                          {sortField === "patient_name" ? (
                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleSort("work_type")}
                      >
                        <div className="flex items-center gap-1">
                          Trabajo
                          {sortField === "work_type" ? (
                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleSort("delivery_date")}
                      >
                        <div className="flex items-center gap-1">
                          Entrega
                          {sortField === "delivery_date" ? (
                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Estado</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Monto</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="border-border/40 hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono font-bold">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          {invoice.patient_name ? (
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{invoice.patient_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          {(() => {
                            const catalogName = invoice.order_items?.[0]?.catalog_item?.name;
                            const label = catalogName || (invoice.work_type ? formatWorkType(invoice.work_type) : null);
                            return label ? (
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm truncate" title={label}>{label}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.delivery_date ? formatSimpleDate(invoice.delivery_date) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-bold uppercase tracking-widest", statusColors[invoice.status] || "")}
                          >
                            {statusLabels[invoice.status] || invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="font-bold text-base">${formatNumber(invoice.total)}</span>
                          {invoice.tax_amount > 0 && (
                            <div className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 inline-block ml-1.5 whitespace-nowrap">IVA</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <InvoiceActions
                            invoice={invoice}
                            isDentist={isDentist}
                            balanceBefore={invoiceBalances[invoice.id]?.before ?? 0}
                            balanceAfter={invoiceBalances[invoice.id]?.after ?? balance}
                            canManageBilling={canManageBilling}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell colSpan={5} className="text-right font-semibold uppercase text-xs tracking-wide text-muted-foreground">TOTALES</TableCell>
                      <TableCell className="text-right font-bold text-base tabular-nums">${formatNumber(totalInvoiced)}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1 font-medium">
                          <div className="text-slate-600">Pagado: ${formatNumber(totalPaid)}</div>
                          <div className="text-slate-700">Pendiente: ${formatNumber(balance)}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              {/* ── Mobile card list ── */}
              <div className="sm:hidden divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden">
                {filteredAndSortedInvoices.map((invoice) => {
                  const catalogName = invoice.order_items?.[0]?.catalog_item?.name;
                  const workLabel = catalogName || (invoice.work_type ? formatWorkType(invoice.work_type) : null);
                  return (
                    <div key={invoice.id} className="px-4 py-3.5 bg-background hover:bg-muted/10 transition-colors">
                      {/* Row 1: Invoice # + Amount */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[12px] font-bold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] px-2 py-0.5 rounded-md">
                          {invoice.invoice_number}
                        </span>
                        <span className="text-[15px] font-bold text-slate-800 tabular-nums">
                          ${formatNumber(invoice.total)}
                        </span>
                      </div>
                      {/* Row 2: Work type + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                          {workLabel ? (
                            <>
                              <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[12px] text-slate-600 truncate">{workLabel}</span>
                            </>
                          ) : (
                            <span className="text-[12px] text-muted-foreground italic">Sin tipo</span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[9px] font-bold uppercase tracking-widest shrink-0", statusColors[invoice.status] || "")}
                        >
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                      </div>
                      {/* Row 3: Patient + Date + Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {invoice.patient_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[11px] text-slate-500 truncate">{invoice.patient_name}</span>
                            </div>
                          )}
                          {invoice.delivery_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[11px] text-slate-400">{formatSimpleDate(invoice.delivery_date)}</span>
                            </div>
                          )}
                        </div>
                        <InvoiceActions
                          invoice={invoice}
                          isDentist={isDentist}
                          balanceBefore={Math.max(0, balance - invoice.total)}
                          balanceAfter={balance}
                          canManageBilling={canManageBilling}
                        />
                      </div>
                    </div>
                  );
                })}
                {/* Mobile totals */}
                <div className="px-4 py-3 bg-muted/30 flex items-center justify-between border-t-2 border-border/40">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pagado</p>
                    <p className="text-[13px] font-bold text-slate-700 tabular-nums">${formatNumber(totalPaid)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
                    <p className="text-[18px] font-extrabold tabular-nums">${formatNumber(totalInvoiced)}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pendiente</p>
                    <p className="text-[13px] font-bold text-slate-700 tabular-nums">${formatNumber(balance)}</p>
                  </div>
                </div>
              </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No se encontraron facturas que coincidan con la búsqueda" : "No hay facturas registradas"}
                </p>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-2"
                  >
                    Limpiar búsqueda
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movements Table */}
      {activeTab === "movements" && (
        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Movimientos Contables</CardTitle>
            <CardDescription className="text-xs font-medium">
              Historial de transacciones y ajustes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {movements.length > 0 ? (
              <div className="space-y-3">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between rounded-2xl border border-border/30 p-4 bg-background/20 hover:bg-background/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm",
                          movement.type === "charge" ? "bg-slate-100" : "bg-secondary/[0.06]"
                        )}
                      >
                        {movement.type === "charge" ? (
                          <TrendingUp className="h-5 w-5 text-slate-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-secondary/80" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {movement.description || (movement.type === "charge" ? "Cargo" : movement.type === "payment" ? "Pago" : "Ajuste")}
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                          <Calendar className="h-3 w-3" />
                          {formatSimpleDate(movement.created_at)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "font-semibold text-base tabular-nums",
                        movement.type === "charge" ? "text-slate-700" : "text-secondary/80"
                      )}
                    >
                      {movement.type === "charge" ? "+" : "-"}$
                      {formatNumber(movement.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay movimientos registrados</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
