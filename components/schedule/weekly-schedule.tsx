"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatDueTime } from "@/lib/date-utils";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Building2,
  User,
  AlertCircle,
} from "lucide-react";
import { formatWorkType } from "@/lib/work-types";
import Link from "next/link";

interface Order {
  id: string;
  order_number: string;
  status: string;
  due_date: string;
  created_at: string;
  notes: string | null;
  patient: { id: string; first_name: string; last_name: string } | null;
  dentist_org: { id: string; name: string } | null;
  lab_org: { id: string; name: string } | null;
  items: Array<{
    work_type: string;
    tooth_positions: string | null;
    shade: string | null;
    catalog_item: { name: string } | null;
  }>;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  notes: string | null;
  status: string;
  patient: { id: string; first_name: string; last_name: string } | null;
}

interface WeeklyScheduleProps {
  orders: Order[];
  appointments?: Appointment[];
  isDentist: boolean;
  weekStartStr: string; // YYYY-MM-DD — string to avoid RSC Date serialization issues
}

const DAYS_OF_WEEK = [
  { name: "Lunes", short: "Lun" },
  { name: "Martes", short: "Mar" },
  { name: "Miércoles", short: "Mié" },
  { name: "Jueves", short: "Jue" },
  { name: "Viernes", short: "Vie" },
  { name: "Sábado", short: "Sáb" },
  { name: "Domingo", short: "Dom" },
];

export function WeeklySchedule({ orders, appointments = [], isDentist, weekStartStr }: WeeklyScheduleProps) {

  // ── Parse YYYY-MM-DD as local Date (no UTC offset) ────────────────────────
  const parseLocalDate = (str: string): Date => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const currentWeekStart = parseLocalDate(weekStartStr);

  // ── Format Date → YYYY-MM-DD (local, no UTC) ──────────────────────────────
  const toDateParam = (d: Date): string =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");

  // ── Pre-compute href URLs (no JS event handlers needed) ──────────────────
  const prevDate = new Date(currentWeekStart);
  prevDate.setDate(prevDate.getDate() - 7);
  const prevWeekUrl = `/dashboard/schedule?week=${toDateParam(prevDate)}`;

  const nextDate = new Date(currentWeekStart);
  nextDate.setDate(nextDate.getDate() + 7);
  const nextWeekUrl = `/dashboard/schedule?week=${toDateParam(nextDate)}`;

  const isCurrentWeek = (() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    return toDateParam(currentWeekStart) === toDateParam(thisMonday);
  })();

  // Group orders by day
  const ordersByDay = useMemo(() => {
    const grouped: Record<number, Order[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
    };

    orders.forEach((order) => {
      const dueDate = new Date(order.due_date);
      const dayDiff = Math.floor(
        (dueDate.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayDiff >= 0 && dayDiff < 7) {
        grouped[dayDiff].push(order);
      }
    });

    return grouped;
  }, [orders, currentWeekStart]);

  // Group appointments by day
  const appointmentsByDay = useMemo(() => {
    const grouped: Record<number, Appointment[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
    };

    appointments.forEach((appointment) => {
      const scheduledDate = new Date(appointment.scheduled_at);
      const dayDiff = Math.floor(
        (scheduledDate.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayDiff >= 0 && dayDiff < 7) {
        grouped[dayDiff].push(appointment);
      }
    });

    // Sort appointments by time within each day
    Object.keys(grouped).forEach((key) => {
      grouped[Number(key)].sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
    });

    return grouped;
  }, [appointments, currentWeekStart]);

  // Calculate stats
  const totalOrders = orders.length;
  const totalAppointments = appointments.length;
  const urgentOrders = orders.filter((order) => {
    const daysUntilDue = Math.ceil(
      (new Date(order.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 2 && daysUntilDue >= 0;
  }).length;
  const todayAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.scheduled_at);
    const today = new Date();
    return (
      aptDate.getDate() === today.getDate() &&
      aptDate.getMonth() === today.getMonth() &&
      aptDate.getFullYear() === today.getFullYear()
    );
  }).length;

  const statusLabels = ORDER_STATUS_LABELS;
  const statusColors = ORDER_STATUS_BADGE_CLASSES;

  const formatDate = (date: Date) => {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    return `${day} ${month}`;
  };

  const formatAppointmentTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const isToday = (dayIndex: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (dayIndex: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 shadow-premium bg-gradient-to-br from-primary to-primary/90 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Calendar className="h-20 w-20" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
              {isCurrentWeek ? "Semana Actual" : "Semana Seleccionada"}
            </p>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-2xl font-bold">
              {formatDate(currentWeekStart)} - {formatDate(
                new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {isDentist ? "Citas Esta Semana" : "Total Entregas"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">
                {isDentist ? totalAppointments : totalOrders}
              </div>
              {isDentist ? (
                <Calendar className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {isDentist ? "Citas Hoy" : "Urgentes (48h)"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn(
                "text-3xl font-bold",
                isDentist
                  ? (todayAppointments > 0 ? "text-secondary" : "text-muted-foreground")
                  : (urgentOrders > 0 ? "text-secondary" : "text-muted-foreground")
              )}>
                {isDentist ? todayAppointments : urgentOrders}
              </div>
              <Clock className={cn(
                "h-4 w-4",
                isDentist
                  ? (todayAppointments > 0 ? "text-secondary" : "text-muted-foreground")
                  : (urgentOrders > 0 ? "text-secondary" : "text-muted-foreground")
              )} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {isDentist ? "Entregas Pendientes" : "Promedio Diario"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">
                {isDentist ? totalOrders : (totalOrders / 7).toFixed(1)}
              </div>
              {isDentist ? (
                <FileText className="h-4 w-4 text-muted-foreground" />
              ) : (
                <span className="text-xs text-muted-foreground">trabajos/día</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Calendar Grid */}
      <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Planificación Semanal</CardTitle>
              <CardDescription className="text-xs font-medium mt-1">
                Trabajos programados para entrega esta semana
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-3" asChild>
                <a href={prevWeekUrl} aria-label="Semana anterior">
                  <ChevronLeft className="h-4 w-4" />
                </a>
              </Button>
              {!isCurrentWeek && (
                <Button
                  variant="outline" size="sm"
                  className="h-8 px-3 text-xs font-semibold text-[#09919b] border-[#b0dde0] hover:bg-[#d2f2f3]"
                  asChild
                >
                  <a href="/dashboard/schedule">Hoy</a>
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8 px-3" asChild>
                <a href={nextWeekUrl} aria-label="Semana siguiente">
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-7 divide-x divide-border/40">
            {DAYS_OF_WEEK.map((day, index) => {
              const date = new Date(currentWeekStart);
              date.setDate(currentWeekStart.getDate() + index);
              const dayOrders = ordersByDay[index] || [];
              const dayAppointments = appointmentsByDay[index] || [];
              const totalItems = dayOrders.length + dayAppointments.length;
              const today = isToday(index);
              const past = isPast(index);

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[400px] border-b border-border/40 lg:border-b-0",
                    today && "bg-primary/5",
                    past && "opacity-60"
                  )}
                >
                  {/* Day Header */}
                  <div className={cn(
                    "sticky top-0 z-10 border-b border-border/40 p-4 bg-muted/30 backdrop-blur-sm",
                    today && "bg-primary/10 border-primary/30"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          today ? "text-primary" : "text-muted-foreground"
                        )}>
                          {day.short}
                        </p>
                        <p className={cn(
                          "text-lg font-bold",
                          today && "text-primary"
                        )}>
                          {date.getDate()}
                        </p>
                      </div>
                      {totalItems > 0 && (
                        <div className="flex items-center gap-1">
                          {isDentist && dayAppointments.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-bold bg-[#e0f4f6] text-[#09919b] border-[#b0dde0]">
                              {dayAppointments.length} <Calendar className="h-3 w-3 ml-0.5 inline" />
                            </Badge>
                          )}
                          {dayOrders.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {dayOrders.length} <FileText className="h-3 w-3 ml-0.5 inline" />
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Day Content */}
                  <div className="p-3 space-y-2">
                    {/* Appointments (Dentist only) */}
                    {isDentist && dayAppointments.length > 0 && (
                      <>
                        {dayAppointments.map((appointment) => {
                          const patientData = appointment.patient;
                          const patient = Array.isArray(patientData) ? patientData[0] : patientData;

                          return (
                            <Link
                              key={appointment.id}
                              href={`/dashboard/appointments/${appointment.id}`}
                              className="block"
                            >
                              <Card className="group cursor-pointer border-2 border-[#b0dde0] hover:border-[#09919b] hover:shadow-md transition-all duration-200 bg-gradient-to-br from-[#f0fafb] to-white overflow-hidden">
                                <CardContent className="p-2.5 space-y-1.5">
                                  {/* Header with time and type badge */}
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-[#09919b] bg-[#e0f4f6] border border-[#b0dde0] px-1.5 py-0.5 rounded-md leading-none">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      {formatAppointmentTime(appointment.scheduled_at)}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0 leading-none shrink-0",
                                        appointment.status === "confirmed"
                                          ? "bg-secondary/[0.08] text-secondary border-secondary/25"
                                          : appointment.status === "cancelled"
                                          ? "bg-rose-50 text-rose-700 border-rose-300"
                                          : "bg-amber-50 text-amber-700 border-amber-300"
                                      )}
                                    >
                                      {appointment.status === "confirmed" ? "Confirmada" :
                                       appointment.status === "cancelled" ? "Cancelada" : "Pendiente"}
                                    </Badge>
                                  </div>

                                  {/* Patient */}
                                  {patient && (
                                    <p className="text-[10px] text-[#044c64] truncate flex items-center gap-1 font-semibold">
                                      <User className="h-3 w-3 shrink-0 text-[#09919b]" />
                                      {patient.first_name} {patient.last_name}
                                    </p>
                                  )}

                                  {/* Notes (if any) */}
                                  {appointment.notes && (
                                    <p className="text-[9px] text-slate-600 truncate italic">
                                      {appointment.notes}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            </Link>
                          );
                        })}
                      </>
                    )}

                    {/* Orders */}
                    {dayOrders.length > 0 && (
                      <>
                        {dayOrders.map((order) => {
                          const patientData = order.patient;
                          const patient = Array.isArray(patientData) ? patientData[0] : patientData;
                          const orgData = isDentist ? order.lab_org : order.dentist_org;
                          const org = Array.isArray(orgData) ? orgData[0] : orgData;

                          return (
                            <Link
                              key={order.id}
                              href={`/dashboard/orders/${order.id}`}
                              className="block"
                            >
                              <Card className="group cursor-pointer border border-border/40 hover:border-primary/40 hover:shadow-md transition-all duration-200 bg-card overflow-hidden">
                                <CardContent className="p-2.5 space-y-1.5">
                                  {/* Order number — full, never truncated */}
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-mono text-[11px] font-bold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md leading-none">
                                      {order.order_number}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0 leading-none shrink-0",
                                        statusColors[order.status]
                                      )}
                                    >
                                      {statusLabels[order.status] || order.status}
                                    </Badge>
                                  </div>

                                  {/* Time */}
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#09919b]">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    {formatDueTime(order.due_date)}
                                  </div>

                                  {/* Patient */}
                                  {patient && (
                                    <p className="text-[10px] text-foreground/70 truncate flex items-center gap-1 font-medium">
                                      <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      {patient.first_name} {patient.last_name}
                                    </p>
                                  )}

                                  {/* Org */}
                                  {org && (
                                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                      <Building2 className="h-3 w-3 shrink-0" />
                                      {org.name}
                                    </p>
                                  )}

                                  {/* Work types */}
                                  {order.items && order.items.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {order.items.slice(0, 1).map((item, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="secondary"
                                          className="text-[9px] px-1.5 py-0 font-medium max-w-full truncate bg-secondary/10 text-secondary border-secondary/20"
                                        >
                                          {item.catalog_item?.name || formatWorkType(item.work_type)}
                                        </Badge>
                                      ))}
                                      {order.items.length > 1 && (
                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 bg-muted text-muted-foreground">
                                          +{order.items.length - 1}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </Link>
                          );
                        })}
                      </>
                    )}

                    {/* Empty state */}
                    {totalItems === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center mb-2">
                          <Calendar className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {isDentist ? "Sin citas ni entregas" : "Sin entregas"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Urgent Orders Alert */}
      {urgentOrders > 0 && (
        <Card className="border-0 overflow-hidden shadow-sm">
          <div className="h-0.5 w-full bg-gradient-to-r from-secondary via-secondary/40 to-transparent" />
          <CardContent className="flex items-center gap-4 p-4 bg-secondary/[0.04]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 border border-secondary/20 shrink-0">
              <AlertCircle className="h-4 w-4 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {urgentOrders} {urgentOrders === 1 ? "entrega urgente" : "entregas urgentes"}
              </p>
              <p className="text-xs text-muted-foreground">
                Requieren atención en las próximas 48 horas
              </p>
            </div>
            <Link href="/dashboard/orders">
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-secondary/30 text-secondary hover:bg-secondary/8 hover:border-secondary/50 text-xs font-semibold"
              >
                Ver Pedidos
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
