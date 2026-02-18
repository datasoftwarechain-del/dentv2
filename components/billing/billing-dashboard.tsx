"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Clock,
  CheckCircle,
  Plus,
  FileText,
  TrendingUp,
  TrendingDown,
  Loader2,
  Calendar,
  User,
  Package,
  Building2,
  ChevronRight,
  AlertCircle,
  Users,
  Check,
} from "lucide-react";

const WORK_TYPE_LABELS: Record<string, string> = {
  corona_metal_ceramica: "Corona Metal-Cerámica",
  corona_zirconia:       "Corona Zirconia",
  corona_emax:           "Corona Emax",
  puente_fijo:           "Puente Fijo",
  protesis_removible:    "Prótesis Removible",
  protesis_total:        "Prótesis Total",
  implante_corona:       "Corona s/ Implante",
  carilla:               "Carilla",
  incrustacion:          "Incrustación",
  ferula:                "Férula",
  retenedor:             "Retenedor",
  reparacion:            "Reparación",
  otro:                  "Otro",
};

function formatWorkType(wt: string | null | undefined): string {
  if (!wt) return "—";
  return WORK_TYPE_LABELS[wt] || wt.replace(/_/g, " ");
}

function shortInvoiceNumber(num: string): string {
  // Keep proper invoice numbers (INV-000001), truncate UUIDs/order refs
  if (num.length <= 16) return num;
  return num.slice(0, 14) + "…";
}
import { InvoiceActions } from "./invoice-actions";
import Link from "next/link";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
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
}

interface LedgerMovement {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
  pendingAmount: number;
}

interface BillingDashboardProps {
  invoices: Invoice[];
  movements: LedgerMovement[];
  isDentist: boolean;
  organizationId: string;
  clients: Client[];
  stats: {
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
  };
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

// Billing statuses use brand palette
// pending → brand mid-teal (waiting, not alarming)
// paid    → emerald (universal "done", harmonizes with teal)
// overdue → rose (critical, reserved only for this)
// cancelled → neutral
const statusColors: Record<string, string> = {
  pending:   "bg-[#d2f2f3] text-[#4b8899] border-[#a8d8dc]",
  paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue:   "bg-rose-50 text-rose-600 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export function BillingDashboard({
  invoices,
  movements,
  isDentist,
  organizationId,
  clients,
  stats,
}: BillingDashboardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
  });

  async function handleMarkAsPaid(invoiceId: string) {
    const supabase = createClient();
    await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    router.refresh();
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      console.log("Registrando pago/cobro:", {
        organizationId,
        isDentist,
        amount: formData.amount
      });

      // Calcular balance actual
      const { data: lastMovement, error: balanceError } = await supabase
        .from("ledger_movements")
        .select("balance")
        .eq(isDentist ? "dentist_org_id" : "lab_org_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError) {
        console.error("Error al obtener balance:", balanceError);
      }

      const currentBalance = lastMovement?.balance || 0;
      const amount = parseFloat(formData.amount);
      const newBalance = isDentist
        ? currentBalance - amount // payment reduce balance
        : currentBalance + amount; // charge increase balance

      console.log("Balance calculado:", {
        currentBalance,
        amount,
        newBalance
      });

      const insertData = {
        [isDentist ? "dentist_org_id" : "lab_org_id"]: organizationId,
        type: isDentist ? "payment" : "charge",
        amount: amount,
        balance: newBalance,
        description: formData.description || null,
      };

      // IMPORTANTE: Necesitamos agregar AMBOS org_ids
      if (isDentist) {
        // Si es dentista, necesitamos lab_org_id también (pero no lo tenemos en este contexto)
        toast.error("Función de registro global no disponible. Use el estado de cuenta del cliente.");
        setLoading(false);
        return;
      } else {
        // Si es laboratorio, necesitamos dentist_org_id también (pero no lo tenemos)
        toast.error("Función de registro global no disponible. Use el estado de cuenta del cliente.");
        setLoading(false);
        return;
      }

      // Este código no se ejecutará por ahora
      const { data: insertedData, error } = await supabase
        .from("ledger_movements")
        .insert(insertData)
        .select();

      if (error) {
        console.error("Error al insertar:", error);
        throw new Error(error?.message || "Error al insertar movimiento");
      }

      console.log("Movimiento insertado:", insertedData);

      setDialogOpen(false);
      setFormData({ amount: "", description: "" });
      toast.success("Movimiento registrado correctamente");
      router.refresh();
    } catch (err: any) {
      console.error("Error completo:", err);
      toast.error(err.message || "Error al registrar movimiento");
    } finally {
      setLoading(false);
    }
  }

  // Calculate additional metrics
  const thisMonth = new Date();
  const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1);
  const thisMonthInvoices = invoices.filter(inv =>
    new Date(inv.created_at).getMonth() === thisMonth.getMonth() &&
    new Date(inv.created_at).getFullYear() === thisMonth.getFullYear()
  );
  const lastMonthInvoices = invoices.filter(inv =>
    new Date(inv.created_at).getMonth() === lastMonth.getMonth() &&
    new Date(inv.created_at).getFullYear() === lastMonth.getFullYear()
  );

  const thisMonthTotal = thisMonthInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const monthGrowth = lastMonthTotal > 0
    ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
    : 0;

  const overdueInvoices = invoices.filter(inv =>
    inv.status === "pending" &&
    inv.due_date &&
    new Date(inv.due_date) < new Date()
  );

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {isDentist ? "Total Gastado" : "Total Facturado"}
            </p>
            <div className="p-2 rounded-xl bg-primary/10 transition-colors">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              ${formatNumber(stats.totalInvoiced)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" /> +8.2% vs mes anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {isDentist ? "Pagado" : "Cobrado"}
            </p>
            <div className="p-2 rounded-xl bg-emerald-500/10 transition-colors">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-emerald-600">
              ${formatNumber(stats.totalPaid)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Estado al día
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Pendiente
            </p>
            <div className="p-2 rounded-xl bg-[#d2f2f3] transition-colors">
              <Clock className="h-4 w-4 text-[#09919b]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-[#09919b]">
              ${formatNumber(stats.totalPending)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
              {invoices.filter(i => i.status === "pending").length} facturas
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {isDentist ? "Laboratorios" : "Clientes"}
            </p>
            <div className="p-2 rounded-xl bg-secondary/10 transition-colors">
              <Users className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-secondary">
              {clients.length}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium flex items-center gap-1">
              {clients.filter(c => c.pendingAmount > 0).length} con saldo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-border/50 shadow-sm bg-background/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Este Mes
                </p>
                <p className="text-2xl font-bold">${formatNumber(thisMonthTotal)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {thisMonthInvoices.length} facturas
                </p>
              </div>
              <div className={cn(
                "flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-lg",
                Number(monthGrowth) >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-500"
              )}>
                {Number(monthGrowth) >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(Number(monthGrowth))}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm bg-background/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Mes Anterior
                </p>
                <p className="text-2xl font-bold">${formatNumber(lastMonthTotal)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {lastMonthInvoices.length} facturas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {overdueInvoices.length > 0 && (
          <Card className="border border-rose-200 shadow-sm bg-rose-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-100">
                  <AlertCircle className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">
                    Facturas Vencidas
                  </p>
                  <p className="text-2xl font-bold text-rose-600">{overdueInvoices.length}</p>
                  <p className="text-[10px] text-rose-500 mt-1">
                    ${formatNumber(overdueInvoices.reduce((sum, inv) => sum + Number(inv.total), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Clients List */}
      {clients.length > 0 && (
        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="border-b border-border/40 pb-6">
            <div>
              <CardTitle className="text-lg font-bold">Estado de Cuenta por Cliente</CardTitle>
              <CardDescription className="text-xs font-medium">
                Ver detalle de facturación por {isDentist ? "laboratorio" : "clínica"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/dashboard/billing/accounts/${client.id}`}
                  className="group"
                >
                  <div className="rounded-2xl border-2 border-border/40 p-4 bg-background/30 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                            {client.name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            {client.invoiceCount} {client.invoiceCount === 1 ? "factura" : "facturas"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold">${formatNumber(client.totalAmount)}</span>
                      </div>
                      {client.pendingAmount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Pendiente</span>
                          <span className="font-bold text-[#09919b]">
                            ${formatNumber(client.pendingAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      <Card className="border border-border shadow-sm bg-background overflow-hidden">
        <CardHeader className="border-b border-border pb-4 px-5 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold">Facturas</CardTitle>
              <CardDescription className="text-xs font-medium">
                {isDentist ? "Control de facturación recibida" : "Gestión de facturas emitidas"}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all">
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar {isDentist ? "Pago" : "Cobro"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                    Registrar {isDentist ? "Pago" : "Cobro"}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Registra manualmente un movimiento contable.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRecordPayment} className="space-y-6 mt-4">
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
                      placeholder="Ej: Pago orden #1024"
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
        </CardHeader>
        <CardContent className="pt-4 px-0 pb-0">
          {invoices.length > 0 ? (<>

            {/* ── DESKTOP TABLE (md+) ───────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border bg-muted/40">
                    {["Factura", "Paciente · Trabajo", isDentist ? "Laboratorio" : "Clínica", "Monto", "Estado", ""].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3 h-10 first:pl-6 last:pr-4">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border/60 hover:bg-muted/20 transition-colors group">
                      {/* Factura + fecha entrega */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                          <div>
                            <p className="font-mono text-xs font-semibold text-foreground/80">
                              {shortInvoiceNumber(invoice.invoice_number)}
                            </p>
                            {invoice.delivery_date && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {formatSimpleDate(invoice.delivery_date)}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Paciente + trabajo */}
                      <TableCell className="py-3.5 max-w-[200px]">
                        <p className="text-sm font-medium truncate">
                          {invoice.patient_name || <span className="text-muted-foreground italic text-xs">Sin paciente</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {formatWorkType(invoice.work_type)}
                        </p>
                      </TableCell>

                      {/* Org */}
                      <TableCell className="py-3.5 text-sm font-medium">
                        {isDentist ? invoice.lab_org?.name : invoice.dentist_org?.name || "—"}
                      </TableCell>

                      {/* Monto */}
                      <TableCell className="py-3.5">
                        <span className="text-base font-bold">${formatNumber(invoice.total)}</span>
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-3.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-semibold uppercase tracking-wide rounded-full px-2.5", statusColors[invoice.status] || "")}
                        >
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="py-3.5 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <InvoiceActions invoice={invoice} isDentist={isDentist} />
                          {!isDentist && invoice.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 hover:text-white border-emerald-300 text-emerald-700 transition-all"
                              onClick={() => handleMarkAsPaid(invoice.id)}
                            >
                              <Check className="h-3 w-3 mr-1" /> Pagada
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ── MOBILE CARDS (<md) ────────────────────────────────── */}
            <div className="md:hidden divide-y divide-border">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="px-4 py-4 hover:bg-muted/20 transition-colors">
                  {/* Row 1: invoice number + amount + status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs font-semibold text-foreground/80 truncate">
                        {shortInvoiceNumber(invoice.invoice_number)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">${formatNumber(invoice.total)}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] font-semibold uppercase tracking-wide rounded-full px-2", statusColors[invoice.status] || "")}
                      >
                        {statusLabels[invoice.status] || invoice.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Row 2: patient + work type */}
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {invoice.patient_name || <span className="text-muted-foreground italic text-xs">Sin paciente</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatWorkType(invoice.work_type)}
                        {(isDentist ? invoice.lab_org?.name : invoice.dentist_org?.name)
                          ? ` · ${isDentist ? invoice.lab_org?.name : invoice.dentist_org?.name}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: delivery date + actions */}
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[11px] text-muted-foreground">
                      {invoice.delivery_date ? formatSimpleDate(invoice.delivery_date) : "Sin fecha entrega"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <InvoiceActions invoice={invoice} isDentist={isDentist} />
                      {!isDentist && invoice.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[10px] font-bold hover:bg-emerald-600 hover:text-white border-emerald-300 text-emerald-700"
                          onClick={() => handleMarkAsPaid(invoice.id)}
                        >
                          <Check className="h-3 w-3 mr-1" /> Pagada
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </>) : (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="h-14 w-14 rounded-2xl bg-muted/30 border border-border flex items-center justify-center mx-auto">
                <FileText className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <div>
                <h3 className="font-bold text-sm">No hay facturas</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Las facturas aparecerán aquí cuando se generen automáticamente.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      {movements.length > 0 && (
        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Movimientos Recientes</CardTitle>
            <CardDescription className="text-xs font-medium text-muted-foreground">Últimos registros del libro contable</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between rounded-2xl border border-border/30 p-4 bg-background/20 hover:bg-background/40 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 shadow-sm",
                        movement.type === "charge" ? "bg-emerald-500/10" : "bg-[#d2f2f3]"
                      )}
                    >
                      {movement.type === "charge" ? (
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-[#09919b]" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">
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
                      "font-bold text-lg",
                      movement.type === "charge" ? "text-emerald-600" : "text-[#09919b]"
                    )}
                  >
                    {movement.type === "charge" ? "+" : "-"}$
                    {formatNumber(movement.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
