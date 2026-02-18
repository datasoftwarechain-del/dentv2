"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Building2, User, Calendar } from "lucide-react";
import { formatDueTime, formatDueDate, formatShortDate, isOverdue, isUrgent } from "@/lib/date-utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";

interface Patient { id: string; first_name: string; last_name: string; }
interface Organization { id: string; name: string; }
interface Order {
  id: string;
  order_number: string;
  status: string;
  items?: { work_type: string | null }[];
  created_at: string;
  due_date: string | null;
  patient: Patient | null;
  dentist_org: Organization | null;
  lab_org: Organization | null;
}
interface OrdersListProps {
  orders: Order[];
  isDentist: boolean;
  organizationId: string;
  patients?: Patient[];
  labs?: Organization[];
  defaultLabId?: string | null;
}

const statusLabels = ORDER_STATUS_LABELS;
const statusColors = ORDER_STATUS_BADGE_CLASSES;

const workTypes = [
  { value: "corona_metal_ceramica", label: "Corona Metal-Cerámica" },
  { value: "corona_zirconia",       label: "Corona Zirconia" },
  { value: "corona_emax",           label: "Corona Emax" },
  { value: "puente_fijo",           label: "Puente Fijo" },
  { value: "protesis_removible",    label: "Prótesis Removible" },
  { value: "protesis_total",        label: "Prótesis Total" },
  { value: "implante_corona",       label: "Corona sobre Implante" },
  { value: "carilla",               label: "Carilla" },
  { value: "incrustacion",          label: "Incrustación" },
  { value: "ferula",                label: "Férula" },
  { value: "retenedor",             label: "Retenedor" },
  { value: "reparacion",            label: "Reparación" },
  { value: "otro",                  label: "Otro" },
];

export function OrdersList({
  orders, isDentist, organizationId, patients = [], labs = [], defaultLabId,
}: OrdersListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOrders = orders.filter((order) => {
    const patientFirst = order.patient?.first_name?.toLowerCase() ?? "";
    const patientLast  = order.patient?.last_name?.toLowerCase()  ?? "";
    const matchesSearch =
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      patientFirst.includes(search.toLowerCase()) ||
      patientLast.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleStatusChange(orderId: string, newStatus: string) {
    const supabase = createClient();
    await supabase.from("lab_orders").update({ status: newStatus }).eq("id", orderId);
    router.refresh();
  }

  return (
    <Card className="border border-border shadow-sm bg-card">
      {/* Header */}
      <CardHeader className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-foreground">Lista de Órdenes</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-0.5">
              {isDentist
                ? "Gestión de órdenes enviadas a laboratorios"
                : "Gestión de órdenes recibidas de clínicas"}
            </CardDescription>
          </div>
          <CreateOrderDialog
            organizationId={organizationId}
            patients={patients}
            labs={labs}
            mode={isDentist ? "dentist" : "lab"}
            defaultLabId={defaultLabId}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filters */}
        <div className="px-5 py-3.5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar orden, paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background text-sm border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 h-9 bg-background border-border text-sm">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="received">Recibido</SelectItem>
              <SelectItem value="missing_info">Falta Info</SelectItem>
              <SelectItem value="in_production">En Producción</SelectItem>
              <SelectItem value="quality_check">Control Calidad</SelectItem>
              <SelectItem value="ready">Listo</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              {/* Column headers — neutral, not brand color */}
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border bg-muted/40">
                  {["Orden", "Paciente", isDentist ? "Laboratorio" : "Clínica", "Trabajo", "Estado", "Creación", "Entrega"].map(h => (
                    <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3 h-10">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredOrders.map((order) => {
                  const workLabel =
                    workTypes.find(t => t.value === order.items?.[0]?.work_type)?.label ||
                    order.items?.[0]?.work_type?.replace(/_/g, " ") || null;

                  // Only flag overdue/urgent for orders still in progress
                  const isActive = !["delivered", "cancelled"].includes(order.status);
                  const overdue = isActive && order.due_date ? isOverdue(order.due_date) : false;
                  const urgent  = isActive && order.due_date ? isUrgent(order.due_date)  : false;

                  return (
                    <TableRow
                      key={order.id}
                      className="hover:bg-muted/25 transition-colors cursor-pointer group border-border/60"
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    >
                      {/* Order number */}
                      <TableCell className="py-3.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md group-hover:border-primary/40 group-hover:text-primary transition-colors">
                          {order.order_number}
                        </span>
                      </TableCell>

                      {/* Patient */}
                      <TableCell className="py-3.5">
                        {order.patient ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">
                              {order.patient.first_name} {order.patient.last_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>

                      {/* Org */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm">
                            {isDentist
                              ? order.lab_org?.name || "Sin asignar"
                              : order.dentist_org?.name || "—"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Work type */}
                      <TableCell className="py-3.5 text-sm">
                        {workLabel || <span className="text-muted-foreground">—</span>}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3.5" onClick={e => e.stopPropagation()}>
                        {!isDentist ? (
                          <Select
                            value={order.status}
                            onValueChange={v => handleStatusChange(order.id, v)}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-7 w-auto min-w-[128px] text-[11px] font-semibold border rounded-full px-3 shadow-none focus:ring-0 focus:ring-offset-0",
                                statusColors[order.status] || "bg-slate-100 text-slate-600 border-slate-200"
                              )}
                            >
                              <span>{statusLabels[order.status] || order.status}</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="missing_info">Falta Info</SelectItem>
                              <SelectItem value="received">Recibido</SelectItem>
                              <SelectItem value="in_production">En Producción</SelectItem>
                              <SelectItem value="quality_check">Control Calidad</SelectItem>
                              <SelectItem value="ready">Listo</SelectItem>
                              <SelectItem value="delivered">Entregado</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold uppercase tracking-wide rounded-full px-2.5",
                              statusColors[order.status] || "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Created at */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatShortDate(order.created_at)}
                        </div>
                      </TableCell>

                      {/* Due date */}
                      <TableCell className="py-3.5">
                        {order.due_date ? (
                          <div>
                            <p className={cn(
                              "text-xs font-semibold",
                              overdue ? "text-[#0d687d]" : urgent ? "text-[#09919b]" : "text-foreground/80"
                            )}>
                              {formatDueDate(order.due_date)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDueTime(order.due_date)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 border border-border mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No hay órdenes</h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
              {isDentist
                ? "Crea tu primera orden para el laboratorio."
                : "Aún no has recibido órdenes de clínicas."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
