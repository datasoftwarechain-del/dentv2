"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { formatWorkType } from "@/lib/work-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, Clock, CheckCircle, Plus, FileText, TrendingUp, TrendingDown,
  Loader2, User, Building2, ChevronRight, AlertCircle, Users, Receipt,
  Calendar, Trash2, Check, X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCSRF } from "@/hooks/useCSRF";

/* ─────────────── Types ─────────────── */
interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface PatientInvoice {
  id: string;
  invoice_number: string;
  patient_id: string | null;
  patient_name: string | null;
  description: string;
  total: number;
  subtotal: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  patient?: Patient | null;
}

interface LabClient {
  id: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
  pendingAmount: number;
}

interface LabInvoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string | null;
  created_at: string;
  patient_name?: string | null;
  work_type?: string | null;
  lab_org: { id: string; name: string } | null;
  order_items?: { work_type?: string | null; catalog_item?: { name: string } | null }[];
}

interface DentistBillingDashboardProps {
  organizationId: string;
  patients: Patient[];
  patientInvoices: PatientInvoice[];
  labClients: LabClient[];
  labInvoices: LabInvoice[];
  stats: {
    totalPatientInvoiced: number;
    totalPatientPaid: number;
    totalPatientPending: number;
    totalLabPending: number;
  };
  isReadOnly?: boolean;
}

/* ─────────────── Status helpers ─────────────── */
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[#d2f2f3] text-[#4b8899] border-[#a8d8dc]",
  paid: "bg-secondary/[0.10] text-secondary border-secondary/25",
  cancelled: "bg-muted text-muted-foreground border-border",
};

/* ─────────────── Component ─────────────── */
export function DentistBillingDashboard({
  organizationId,
  patients,
  patientInvoices: initialPatientInvoices,
  labClients,
  labInvoices,
  stats,
  isReadOnly = false,
}: DentistBillingDashboardProps) {
  const router = useRouter();
  const { csrfToken } = useCSRF();

  const [activeTab, setActiveTab] = useState<"patients" | "lab">(isReadOnly ? "lab" : "patients");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientInvoices, setPatientInvoices] = useState(initialPatientInvoices);
  const [searchTerm, setSearchTerm] = useState("");

  // Create invoice form state
  const [form, setForm] = useState({
    patientId: "",
    useManual: false,
    manualName: "",
    description: "",
    total: "",
    dueDate: "",
    notes: "",
  });

  /* ─── Create invoice ─── */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.total || isNaN(Number(form.total))) {
      toast.error("Ingresa un monto válido");
      return;
    }
    setLoading(true);
    try {
      const selectedPatient = patients.find(p => p.id === form.patientId);
      const patientName = form.useManual
        ? form.manualName.trim()
        : selectedPatient
          ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
          : null;

      const res = await fetch("/api/billing/patient-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          patientId: form.useManual ? null : form.patientId || null,
          patientName,
          description: form.description,
          total: Number(form.total),
          subtotal: Number(form.total),
          dueDate: form.dueDate || null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear factura");

      setPatientInvoices([data.data, ...patientInvoices]);
      setCreateOpen(false);
      setForm({ patientId: "", useManual: false, manualName: "", description: "", total: "", dueDate: "", notes: "" });
      toast.success(`Factura ${data.data.invoice_number} creada`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Mark as paid ─── */
  async function handleMarkPaid(invoiceId: string) {
    try {
      const res = await fetch("/api/billing/patient-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ id: invoiceId, status: "paid" }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      setPatientInvoices(prev =>
        prev.map(inv => inv.id === invoiceId ? { ...inv, status: "paid", paid_at: new Date().toISOString() } : inv)
      );
      toast.success("Factura marcada como pagada");
    } catch {
      toast.error("Error al actualizar factura");
    }
  }

  /* ─── Delete invoice ─── */
  async function handleDelete(invoiceId: string, invoiceNumber: string) {
    if (!confirm(`¿Eliminar factura ${invoiceNumber}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/billing/patient-invoices?id=${invoiceId}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      setPatientInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      toast.success("Factura eliminada");
    } catch {
      toast.error("Error al eliminar factura");
    }
  }

  /* ─── Derived data ─── */
  const filteredInvoices = patientInvoices.filter(inv => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(term) ||
      (inv.patient_name || "").toLowerCase().includes(term) ||
      inv.description.toLowerCase().includes(term)
    );
  });

  // Group by patient for summary cards
  const patientSummary = (() => {
    const map = new Map<string, { name: string; total: number; pending: number; count: number }>();
    patientInvoices.forEach(inv => {
      const key = inv.patient_id || inv.patient_name || "Sin paciente";
      const name = inv.patient_name || "Sin paciente";
      const existing = map.get(key) || { name, total: 0, pending: 0, count: 0 };
      existing.total += Number(inv.total);
      if (inv.status === "pending") existing.pending += Number(inv.total);
      existing.count++;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.pending - a.pending);
  })();

  const overdueInvoices = patientInvoices.filter(inv =>
    inv.status === "pending" && inv.due_date && new Date(inv.due_date) < new Date()
  );

  return (
    <div className="space-y-8">
      {/* ─── Stats ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 shadow-sm bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Facturado Pacientes</p>
            <div className="p-2 rounded-xl bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${formatNumber(stats.totalPatientInvoiced)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{patientInvoices.length} facturas emitidas</p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Cobrado</p>
            <div className="p-2 rounded-xl bg-secondary/[0.10]"><CheckCircle className="h-4 w-4 text-secondary" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">${formatNumber(stats.totalPatientPaid)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Recibido
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Pendiente Cobrar</p>
            <div className="p-2 rounded-xl bg-[#d2f2f3]"><Clock className="h-4 w-4 text-[#09919b]" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#09919b]">${formatNumber(stats.totalPatientPending)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              {patientInvoices.filter(i => i.status === "pending").length} facturas
            </p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border shadow-sm bg-background/50",
          stats.totalLabPending > 0 ? "border-primary/30" : "border-border/50"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">A Pagar Lab</p>
            <div className={cn("p-2 rounded-xl", stats.totalLabPending > 0 ? "bg-primary/10" : "bg-muted/30")}>
              <Building2 className={cn("h-4 w-4", stats.totalLabPending > 0 ? "text-primary" : "text-muted-foreground")} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold", stats.totalLabPending > 0 ? "text-primary" : "")}>
              ${formatNumber(stats.totalLabPending)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{labClients.length} laboratorio(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue alert */}
      {overdueInvoices.length > 0 && (
        <Card className="border-2 border-red-200 bg-red-50/50 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-700">
                  {overdueInvoices.length} factura{overdueInvoices.length > 1 ? "s" : ""} vencida{overdueInvoices.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-red-600">
                  Total: ${formatNumber(overdueInvoices.reduce((s, i) => s + Number(i.total), 0))} pendiente de cobro
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 border-b border-border/60">
        {([
          { key: "patients", label: "Facturación a Pacientes", icon: Users },
          { key: "lab", label: "Estado de Cuenta Lab", icon: Building2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px",
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Pacientes ─── */}
      {activeTab === "patients" && (
        <div className="space-y-6">
          {/* Patient summary cards */}
          {patientSummary.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {patientSummary.slice(0, 6).map((ps) => (
                <div key={ps.name} className="rounded-2xl border border-border/40 p-4 bg-background/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{ps.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ps.count} factura{ps.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-border/30">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold">${formatNumber(ps.total)}</span>
                  </div>
                  {ps.pending > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Pendiente</span>
                      <span className="font-bold text-[#09919b]">${formatNumber(ps.pending)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Invoices table */}
          <Card className="border border-border/50 shadow-sm bg-background/50">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Facturas a Pacientes
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">
                    Gestión de cobros por servicios dentales
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Buscar factura..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 w-48 text-sm bg-background"
                  />
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    {!isReadOnly && (
                      <DialogTrigger asChild>
                        <Button className="h-9 font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                          <Plus className="mr-2 h-4 w-4" /> Nueva Factura
                        </Button>
                      </DialogTrigger>
                    )}
                    <DialogContent className="sm:max-w-[480px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                          Nueva Factura a Paciente
                        </DialogTitle>
                        <DialogDescription>Emite una factura por servicios dentales</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreate} className="space-y-5 mt-3">
                        {/* Patient */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Paciente</Label>
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, useManual: !f.useManual, patientId: "", manualName: "" }))}
                              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                            >
                              <User className="h-3.5 w-3.5" />
                              {form.useManual ? "Seleccionar existente" : "Ingresar nombre manual"}
                            </button>
                          </div>
                          {form.useManual ? (
                            <Input
                              placeholder="Nombre completo del paciente"
                              value={form.manualName}
                              onChange={e => setForm(f => ({ ...f, manualName: e.target.value }))}
                              className="bg-background"
                            />
                          ) : (
                            <Select
                              value={form.patientId}
                              onValueChange={v => setForm(f => ({ ...f, patientId: v }))}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Seleccionar paciente..." />
                              </SelectTrigger>
                              <SelectContent>
                                {patients.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.first_name} {p.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                          <Label>Descripción del servicio <span className="text-rose-500">*</span></Label>
                          <Input
                            placeholder="Ej: Extracción molar, Limpieza dental..."
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="bg-background"
                            required
                          />
                        </div>

                        {/* Amount + Due date */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Monto total <span className="text-rose-500">*</span></Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="pl-9 bg-background font-bold"
                                value={form.total}
                                onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha de vencimiento</Label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="date"
                                className="pl-9 bg-background"
                                value={form.dueDate}
                                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <Label>Notas adicionales</Label>
                          <Textarea
                            placeholder="Observaciones..."
                            className="resize-none min-h-[72px] bg-background"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Factura
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {filteredInvoices.length > 0 ? (
                <div className="rounded-2xl border border-border/40 overflow-hidden bg-background/20">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nº</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paciente</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monto</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vence</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map(inv => {
                        const isOverdue = inv.status === "pending" && inv.due_date && new Date(inv.due_date) < new Date();
                        return (
                          <TableRow key={inv.id} className={cn("border-border/40 hover:bg-muted/20 transition-colors", isOverdue && "bg-red-50/30")}>
                            <TableCell className="font-mono font-bold text-sm py-4">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                {inv.invoice_number}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="font-medium text-sm">{inv.patient_name || "Sin paciente"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                              <span className="truncate block" title={inv.description}>{inv.description}</span>
                            </TableCell>
                            <TableCell className="font-bold text-base">${formatNumber(inv.total)}</TableCell>
                            <TableCell className={cn("text-sm font-medium", isOverdue && "text-red-600 font-bold")}>
                              {inv.due_date ? formatSimpleDate(inv.due_date) : "-"}
                              {isOverdue && <span className="ml-1 text-[9px] uppercase tracking-wider bg-red-100 text-red-600 px-1 rounded">Vencida</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider", STATUS_COLORS[inv.status])}>
                                {STATUS_LABELS[inv.status] || inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {inv.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px] font-bold hover:bg-secondary hover:text-white transition-all"
                                    onClick={() => handleMarkPaid(inv.id)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />Cobrada
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleDelete(inv.id, inv.invoice_number)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-16 text-center space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
                    <Receipt className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{searchTerm ? "Sin resultados" : "No hay facturas emitidas"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchTerm ? "Intenta con otro término de búsqueda" : "Crea tu primera factura con el botón Nueva Factura"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Tab: Estado de Cuenta Lab ─── */}
      {activeTab === "lab" && (
        <div className="space-y-6">
          {labClients.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {labClients.map(lab => (
                  <Link key={lab.id} href={`/dashboard/billing/accounts/${lab.id}`} className="group">
                    <div className="rounded-2xl border-2 border-border/40 p-5 bg-background/30 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{lab.name}</h4>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {lab.invoiceCount} factura{lab.invoiceCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                      </div>
                      <div className="space-y-2 pt-3 border-t border-border/30">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total facturado</span>
                          <span className="font-bold">${formatNumber(lab.totalAmount)}</span>
                        </div>
                        {lab.pendingAmount > 0 ? (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Saldo pendiente</span>
                            <span className="font-bold text-primary">${formatNumber(lab.pendingAmount)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-secondary">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span className="font-bold">Al día</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary group-hover:underline">
                          Ver estado de cuenta completo →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Recent lab invoices */}
              {labInvoices.length > 0 && (
                <Card className="border border-border/50 shadow-sm bg-background/50">
                  <CardHeader className="border-b border-border/40 pb-4">
                    <CardTitle className="text-base font-bold">Últimas Facturas Recibidas del Laboratorio</CardTitle>
                    <CardDescription className="text-xs">Cargos más recientes de tus laboratorios</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="rounded-2xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-border/40">
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Factura</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Laboratorio</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paciente / Trabajo</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monto</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {labInvoices.slice(0, 10).map(inv => (
                            <TableRow key={inv.id} className="border-border/40 hover:bg-muted/20 transition-colors">
                              <TableCell className="font-mono font-bold text-sm py-3">{inv.invoice_number}</TableCell>
                              <TableCell className="font-medium text-sm">{inv.lab_org?.name}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {inv.patient_name && <p className="font-medium">{inv.patient_name}</p>}
                                  {(() => {
                                    const catalogName = inv.order_items?.[0]?.catalog_item?.name;
                                    const label = catalogName || formatWorkType(inv.work_type);
                                    return label && label !== "—"
                                      ? <p className="text-xs text-muted-foreground">{label}</p>
                                      : null;
                                  })()}
                                  {!inv.patient_name && !inv.order_items?.[0]?.catalog_item?.name && !inv.work_type && <span className="text-muted-foreground text-xs">-</span>}
                                </div>
                              </TableCell>
                              <TableCell className="font-bold">${formatNumber(inv.total)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", STATUS_COLORS[inv.status] || "")}>
                                  {STATUS_LABELS[inv.status] || inv.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border border-border/50 shadow-sm bg-background/50">
              <CardContent className="py-16 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-bold text-sm">Sin facturas de laboratorio</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Las facturas de tus laboratorios aparecerán aquí automáticamente
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
