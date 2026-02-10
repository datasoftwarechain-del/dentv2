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
} from "lucide-react";
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

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  paid: "bg-green-100 text-green-800 hover:bg-green-100",
  overdue: "bg-red-100 text-red-800 hover:bg-red-100",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
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
            <div className="p-2 rounded-xl bg-amber-500/10 transition-colors">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-amber-600">
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
                Number(monthGrowth) >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
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
          <Card className="border-2 border-red-200 shadow-sm bg-red-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">
                    Facturas Vencidas
                  </p>
                  <p className="text-2xl font-bold text-red-700">{overdueInvoices.length}</p>
                  <p className="text-[10px] text-red-600 mt-1">
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
                          <span className="font-bold text-amber-600">
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
      <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/40 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Facturas</CardTitle>
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
        <CardContent className="pt-6">
          {invoices.length > 0 ? (
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-background/30">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Factura</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paciente</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trabajo</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isDentist ? "Laboratorio" : "Clinica"}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monto</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Entrega</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border/40 hover:bg-muted/20 transition-colors group">
                      <TableCell className="font-bold py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="font-mono">{invoice.invoice_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.patient_name ? (
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{invoice.patient_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Sin paciente</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {invoice.work_type ? (
                          <div className="flex items-center gap-2 max-w-[180px]">
                            <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate" title={invoice.work_type}>
                              {invoice.work_type}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Sin especificar</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {isDentist
                          ? invoice.lab_org?.name
                          : invoice.dentist_org?.name}
                      </TableCell>
                      <TableCell className="font-bold text-base">
                        ${formatNumber(invoice.total)}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {invoice.delivery_date
                          ? formatSimpleDate(invoice.delivery_date)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-bold uppercase tracking-widest", statusColors[invoice.status] || "")}
                        >
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <InvoiceActions invoice={invoice} isDentist={isDentist} />
                          {!isDentist && invoice.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all"
                              onClick={() => handleMarkAsPaid(invoice.id)}
                            >
                              Marcar Pagada
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div className="max-w-[200px] mx-auto text-sm">
                <h3 className="font-bold">No hay facturas</h3>
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
                        movement.type === "charge" ? "bg-emerald-500/10" : "bg-rose-500/10"
                      )}
                    >
                      {movement.type === "charge" ? (
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-rose-600" />
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
                      movement.type === "charge" ? "text-emerald-600" : "text-rose-600"
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
