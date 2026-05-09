"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Search, FileText, Building2, User, Calendar, ChevronDown, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
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
interface InitialFilters {
  q: string;
  patient: string;
  client: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface OrdersListProps {
  orders: Order[];
  isDentist: boolean;
  organizationId: string;
  patients?: Patient[];
  labs?: Organization[];
  defaultLabId?: string | null;
  canCreate?: boolean;
  canUpdateStatus?: boolean;
  showPrices?: boolean;
  // [Sección 5] Paginación + filtros server-side
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  totalPages?: number;
  initialFilters?: InitialFilters;
}

const statusLabels = ORDER_STATUS_LABELS;
const statusColors = ORDER_STATUS_BADGE_CLASSES;

const statusOptions = [
  { value: "all",            label: "Todos los estados" },
  { value: "received",       label: "Recibido" },
  { value: "in_production",  label: "En Curso" },
  { value: "ready",          label: "Listo" },
  { value: "delivered",      label: "Entregado" },
  { value: "cancelled",      label: "Cancelado" },
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
    setLocalStatus(newStatus);

    const supabase = createClient();
    const { error } = await supabase
      .from("lab_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    setLoading(false);

    if (error) {
      setLocalStatus(prev);
      toast.error("No se pudo actualizar el estado", { description: error.message });
    } else {
      toast.success(`Estado actualizado: ${statusLabels[newStatus] || newStatus}`);
      onChanged(newStatus);
    }
  }

  const colorClass = statusColors[localStatus] || "bg-slate-100 text-slate-600 border-slate-200";
  const pickerOptions = statusOptions.filter((o) => o.value !== "all");

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
        {loading ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : null}
        <span className="flex-1">{statusLabels[localStatus] || localStatus}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {pickerOptions.map((opt) => (
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

// ──────────────────────────────────────────────
// OrdersList — server-driven (URL ↔ filtros, paginación)
// ──────────────────────────────────────────────
export function OrdersList({
  orders, isDentist, organizationId, patients = [], labs = [], defaultLabId,
  canCreate = true, canUpdateStatus = true, showPrices = true,
  totalCount = 0, currentPage = 1, pageSize = 25, totalPages = 1,
  initialFilters,
}: OrdersListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams();

  // Inputs locales — comienzan con valores del server (URL).
  // Los selects/dates pushean cambio a URL inmediatamente; los inputs de
  // texto debounce-ean 350ms para no spammear.
  const [q, setQ] = useState(initialFilters?.q ?? "");
  const [patientQ, setPatientQ] = useState(initialFilters?.patient ?? "");
  const clientId = initialFilters?.client ?? "";
  const status = initialFilters?.status ?? "";
  const dateFrom = initialFilters?.dateFrom ?? "";
  const dateTo = initialFilters?.dateTo ?? "";

  // Status local (optimistic) cuando el usuario cambia el estado in-row.
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  // Sincronizar inputs si cambia la URL desde fuera (back/forward).
  useEffect(() => {
    setQ(initialFilters?.q ?? "");
    setPatientQ(initialFilters?.patient ?? "");
  }, [initialFilters?.q, initialFilters?.patient]);

  const buildHref = useCallback(
    (overrides: Partial<Record<string, string>>) => {
      const sp = new URLSearchParams(searchParamsHook?.toString() ?? "");
      for (const [k, v] of Object.entries(overrides)) {
        if (v == null || v === "" || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      return `${pathname}${qs ? `?${qs}` : ""}`;
    },
    [pathname, searchParamsHook],
  );

  const updateUrl = useCallback(
    (overrides: Partial<Record<string, string>>, opts?: { resetPage?: boolean }) => {
      const final: Partial<Record<string, string>> = { ...overrides };
      if (opts?.resetPage !== false) final.page = ""; // borra page → vuelve a 1
      router.replace(buildHref(final), { scroll: false });
    },
    [buildHref, router],
  );

  // Debounce inputs de texto (q, patient).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const currentQ = initialFilters?.q ?? "";
    const currentPatient = initialFilters?.patient ?? "";
    if (q === currentQ && patientQ === currentPatient) return;
    debounceRef.current = setTimeout(() => {
      updateUrl({ q, patient: patientQ });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, patientQ]);

  function handleStatusFilterChange(value: string) {
    updateUrl({ status: value });
  }

  function handleClientFilterChange(value: string) {
    updateUrl({ client: value });
  }

  function handleDateFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateUrl({ date_from: e.target.value });
  }

  function handleDateToChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateUrl({ date_to: e.target.value });
  }

  function clearFilters() {
    setQ("");
    setPatientQ("");
    router.replace(pathname, { scroll: false });
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    updateUrl({ page: p === 1 ? "" : String(p) }, { resetPage: false });
  }

  const ordersWithStatus = orders.map((o) => ({
    ...o,
    status: statusMap[o.id] ?? o.status,
  }));

  const hasActiveFilters = useMemo(
    () => Boolean(q || patientQ || clientId || (status && status !== "all") || dateFrom || dateTo),
    [q, patientQ, clientId, status, dateFrom, dateTo],
  );

  // Display range: "Mostrando X-Y de N"
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

  const clientLabel = isDentist ? "Laboratorio" : "Cliente";

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
        {/* Filters — URL-driven */}
        <div className="px-5 py-3.5 border-b border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Número de orden */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Número de orden..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-9 bg-background text-sm border-border"
              />
            </div>
            {/* Paciente */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Paciente..."
                value={patientQ}
                onChange={(e) => setPatientQ(e.target.value)}
                className="pl-9 h-9 bg-background text-sm border-border"
              />
            </div>
            {/* Cliente / Lab */}
            <Select
              value={clientId || "all"}
              onValueChange={(v) => handleClientFilterChange(v === "all" ? "" : v)}
            >
              <SelectTrigger className="h-9 bg-background border-border text-sm">
                <SelectValue placeholder={clientLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los {isDentist ? "laboratorios" : "clientes"}</SelectItem>
                {labs.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Estado */}
            <Select
              value={status || "all"}
              onValueChange={(v) => handleStatusFilterChange(v)}
            >
              <SelectTrigger className="h-9 bg-background border-border text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px] max-w-[200px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Desde
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={handleDateFromChange}
                className="h-9 bg-background text-sm border-border"
              />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[200px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Hasta
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={handleDateToChange}
                className="h-9 bg-background text-sm border-border"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground self-end"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {ordersWithStatus.length > 0 ? (
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
                {ordersWithStatus.map((order) => {
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
                      <TableCell className="py-3.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md group-hover:border-primary/40 group-hover:text-primary transition-colors whitespace-nowrap">
                          {order.order_number}
                        </span>
                      </TableCell>

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

                      <TableCell className="py-3.5 text-sm">
                        {workLabel || <span className="text-muted-foreground">—</span>}
                      </TableCell>

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

                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatShortDate(order.created_at)}
                        </div>
                      </TableCell>

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
            {ordersWithStatus.map((order) => {
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

                  {workLabel && (
                    <p className="text-[13px] font-semibold text-foreground mb-2 leading-snug">{workLabel}</p>
                  )}

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

          {/* Paginación */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              {totalCount === 0
                ? "Sin resultados"
                : `Mostrando ${rangeStart}-${rangeEnd} de ${totalCount}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="h-8 px-3 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-8 px-3 text-xs"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 border border-border mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {hasActiveFilters ? "Sin resultados con esos filtros" : "No hay órdenes"}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
              {hasActiveFilters
                ? "Probá ajustar los filtros o limpialos para ver todo."
                : isDentist
                ? "Crea tu primera orden para el laboratorio."
                : "Aún no has recibido órdenes de clínicas."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                Limpiar filtros
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
