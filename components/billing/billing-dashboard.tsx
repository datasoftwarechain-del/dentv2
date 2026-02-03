"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string | null;
  created_at: string;
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

interface BillingDashboardProps {
  invoices: Invoice[];
  movements: LedgerMovement[];
  isDentist: boolean;
  organizationId: string;
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
      await supabase.from("ledger_movements").insert({
        [isDentist ? "dentist_org_id" : "lab_org_id"]: organizationId,
        type: isDentist ? "expense" : "income",
        amount: parseFloat(formData.amount),
        description: formData.description || null,
      });

      setDialogOpen(false);
      setFormData({ amount: "", description: "" });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              ${stats.totalInvoiced.toLocaleString()}
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
              ${stats.totalPaid.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Estado al día
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
              ${stats.totalPending.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium">Requiere seguimiento</p>
          </CardContent>
        </Card>
      </div>

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
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isDentist ? "Laboratorio" : "Clinica"}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monto</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vencimiento</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                    {!isDentist && <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border/40 hover:bg-muted/20 transition-colors group">
                      <TableCell className="font-bold py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          {invoice.invoice_number}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {isDentist
                          ? invoice.lab_org?.name
                          : invoice.dentist_org?.name}
                      </TableCell>
                      <TableCell className="font-bold">
                        ${Number(invoice.total).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {invoice.due_date
                          ? new Date(invoice.due_date).toLocaleDateString("es-ES")
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
                      {!isDentist && (
                        <TableCell className="text-right">
                          {invoice.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-all"
                              onClick={() => handleMarkAsPaid(invoice.id)}
                            >
                              Marcar Pagada
                            </Button>
                          )}
                        </TableCell>
                      )}
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
                        movement.type === "income" ? "bg-emerald-500/10" : "bg-rose-500/10"
                      )}
                    >
                      {movement.type === "income" ? (
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-rose-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">
                        {movement.description || (movement.type === "income" ? "Ingreso" : "Egreso")}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        <Calendar className="h-3 w-3" />
                        {new Date(movement.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-bold text-lg",
                      movement.type === "income" ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {movement.type === "income" ? "+" : "-"}$
                    {Number(movement.amount).toLocaleString()}
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
