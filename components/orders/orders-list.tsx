"use client";

import { useState, useRef, useEffect } from "react";
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
import { Search, FileText, Building2, User, Calendar, ChevronDown, Loader2 } from "lucide-react";
import { formatDueTime, formatDueDate, formatShortDate, isOverdue, isUrgent } from "@/lib/date-utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatWorkType } from "@/lib/work-types";
import { getArancelLabel } from "@/lib/catalog-types";
import { toast } from "sonner";

interface Patient { id: string; first_name: string; last_name: string; }
interface Organization { id: string; name: string; }
interface Order {
  id: string;
  order_number: string;
  status: string;
  items?: { work_type: string | null; arancel_type?: string | null; catalog_item?: { name: string } | null }[];
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
  /** Whether the user can create new orders (default: true) */
  canCreate?: boolean;
  /** Whether the user can change order status (default: true) */
  canUpdateStatus?: boolean;
  /** Whether the user can see prices (default: true) */
  showPrices?: boolean;
}

const statusLabels = ORDER_STATUS_LABELS;
const statusColors = ORDER_STATUS_BADGE_CLASSES;


const statusOptions = [
  { value: "received",     label: "Recibido" },
  { value: "in_production", label: "En Curso" },
  { value: "ready",        label: "Listo" },
  { value: "delivered",    label: "Entregado" },
];

// ──────────────────────────────────────────────
// Inline status picker — no portal, funciona dentro de tablas
// ──────────────────────────────────────────────
function StatusPicker({
  orderId,
  currentStatus,
  onChanged,
}: {
  orderId: string;
  currentStatus: string;
  onChanged: (newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(currentStatus);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync if parent re-renders with new status
  useEffect(() => { setLocalStatus(currentStatus); }, [currentStatus]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSelect(newStatus: string) {
    if (newStatus === localStatus) { setOpen(false); return; }
    setOpen(false);
    setLoading(true);
    const prev = localStatus;
    setLocalStatus(newStatus); // optimistic

    const supabase = createClient();
    const { error } = await supabase
      .from("lab_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    setLoading(false);

    if (error) {
      setLocalStatus(prev); // revert
      toast.error("No se pudo actualizar el estado", { description: error.message });
    } else {
      toast.success(`Estado actualizado: ${statusLabels[newStatus] || newStatus}`);
      onChanged(newStatus);
    }
  }

  const colorClass = statusColors[localStatus] || "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "h-7 flex items-center gap-1.5 min-w-[128px] text-[11px] font-semibold border rounded-full px-3 transition-opacity",
          colorClass,
          loading && "opacity-60 cursor-not-allowed"
        )}
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          : null}
        <span className="flex-1">{statusLabels[localStatus] || localStatus}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between",
                localStatus === opt.value && "font-semibold"
              )}
            >
              {opt.label}
              {localStatus === opt.value && <span className="text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrdersList({
  orders: initialOrders, isDentist, organizationId, patients = [], labs = [], defaultLabId,
  canCreate = true, canUpdateStatus = true, showPrices = true,
}: OrdersListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Track status changes locally (optimistic)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  const ordersWithStatus = initialOrders.map((o) => ({
    ...o,
    status: statusMap[o.id] ?? o.status,
  }));

  const filteredOrders = ordersWithStatus.filter((order) => {
    const patientFirst = order.patient?.first_name?.toLowerCase() ?? "";
    const patientLast  = order.patient?.last_name?.toLowerCase()  ?? "";
    const matchesSearch =
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      patientFirst.includes(search.toLowerCase()) ||
      patientLast.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          {canCreate && (
            <CreateOrderDialog
              organizationId={organizationId}
              patients={patients}
              labs={labs}
              mode={isDentist ? "dentist" : "lab"}
              defaultLabId={defaultLabId}
              showPrices={showPrices}
            />
          )}
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
              <SelectItem value="received">Recibido</SelectItem>
              <SelectItem value="in_production">En Curso</SelectItem>
              <SelectItem value="ready">Listo</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredOrders.length > 0 ? (
          <>
          {/* ── Desktop table ── */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
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
                  const firstItem = order.items?.[0];
                  const arancelSuffix = firstItem?.arancel_type ? ` · ${getArancelLabel(firstItem.arancel_type)}` : "";
                  const workLabel = firstItem?.catalog_item?.name
                    ? `${firstItem.catalog_item.name}${arancelSuffix}`
                    : firstItem?.work_type
                    ? `${formatWorkType(firstItem.work_type)}${arancelSuffix}`
                    : null;

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
                        <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md group-hover:border-primary/40 group-hover:text-primary transition-colors whitespace-nowrap">
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
                        {!isDentist && canUpdateStatus ? (
                          <StatusPicker
                            orderId={order.id}
                            currentStatus={order.status}
                            onChanged={(newStatus) => {
                              setStatusMap((prev) => ({ ...prev, [order.id]: newStatus }));
                              router.refresh();
                            }}
                          />
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

          {/* ── Mobile card list ── */}
          <div className="sm:hidden divide-y divide-border/60">
            {filteredOrders.map((order) => {
                const firstItem = order.items?.[0];
                const arancelSuffix = firstItem?.arancel_type ? ` · ${getArancelLabel(firstItem.arancel_type)}` : "";
                const workLabel = firstItem?.catalog_item?.name
                  ? `${firstItem.catalog_item.name}${arancelSuffix}`
                  : firstItem?.work_type
                  ? `${formatWorkType(firstItem.work_type)}${arancelSuffix}`
                  : null;
              const isActive = !["delivered", "cancelled"].includes(order.status);
              const overdue = isActive && order.due_date ? isOverdue(order.due_date) : false;
              const urgent  = isActive && order.due_date ? isUrgent(order.due_date) : false;

              return (
                <div
                  key={`m-${order.id}`}
                  className="px-4 py-3.5 hover:bg-muted/20 active:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                >
                  {/* Fila 1: Número + Estado */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono text-[12px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {order.order_number}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      {!isDentist ? (
                        <StatusPicker
                          orderId={order.id}
                          currentStatus={order.status}
                          onChanged={(newStatus) => {
                            setStatusMap((prev) => ({ ...prev, [order.id]: newStatus }));
                            router.refresh();
                          }}
                        />
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
                    </div>
                  </div>

                  {/* Fila 2: Tipo de trabajo */}
                  {workLabel && (
                    <p className="text-[13px] font-semibold text-foreground mb-2 leading-snug">{workLabel}</p>
                  )}

                  {/* Fila 3: Paciente + Organización */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                    {order.patient && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-slate-600">
                          {order.patient.first_name} {order.patient.last_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[12px] text-slate-500 truncate max-w-[140px]">
                        {isDentist ? order.lab_org?.name || "Sin asignar" : order.dentist_org?.name || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Fila 4: Fechas */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{formatShortDate(order.created_at)}</span>
                    </div>
                    {order.due_date && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className={cn(
                          "font-semibold",
                          overdue ? "text-red-600" : urgent ? "text-amber-500" : "text-muted-foreground"
                        )}>
                          Entrega: {formatDueDate(order.due_date)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
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
