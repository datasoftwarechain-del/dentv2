"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatDueTime, formatShortDate } from "@/lib/date-utils";
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
  }>;
}

interface WeeklyScheduleProps {
  orders: Order[];
  isDentist: boolean;
  weekStart: Date;
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

export function WeeklySchedule({ orders, isDentist, weekStart }: WeeklyScheduleProps) {
  const [currentWeekStart] = useState(weekStart);

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

  // Calculate stats
  const totalOrders = orders.length;
  const urgentOrders = orders.filter((order) => {
    const daysUntilDue = Math.ceil(
      (new Date(order.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 2 && daysUntilDue >= 0;
  }).length;

  const statusLabels = ORDER_STATUS_LABELS;
  const statusColors = ORDER_STATUS_BADGE_CLASSES;

  const formatDate = (date: Date) => {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    return `${day} ${month}`;
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
              Semana Actual
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
              Total Entregas
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{totalOrders}</div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Urgentes (48h)
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn(
                "text-3xl font-bold",
                urgentOrders > 0 ? "text-amber-600" : "text-emerald-600"
              )}>
                {urgentOrders}
              </div>
              <Clock className={cn(
                "h-4 w-4",
                urgentOrders > 0 ? "text-amber-600" : "text-emerald-600"
              )} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Promedio Diario
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">
                {(totalOrders / 7).toFixed(1)}
              </div>
              <span className="text-xs text-muted-foreground">trabajos/día</span>
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
              <Button variant="outline" size="sm" className="h-8 px-3" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3" disabled>
                <ChevronRight className="h-4 w-4" />
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
                      {dayOrders.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {dayOrders.length}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Day Content */}
                  <div className="p-3 space-y-2">
                    {dayOrders.length > 0 ? (
                      dayOrders.map((order) => {
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
                            <Card className="group cursor-pointer border border-border/30 hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-background/50 backdrop-blur-sm overflow-hidden">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                                        {order.order_number}
                                      </p>
                                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">
                                        {formatDueTime(order.due_date)}
                                      </span>
                                    </div>
                                    {patient && (
                                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                        <User className="h-2.5 w-2.5" />
                                        {patient.first_name} {patient.last_name}
                                      </p>
                                    )}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] font-bold uppercase px-1.5 py-0",
                                      statusColors[order.status]
                                    )}
                                  >
                                    {statusLabels[order.status]?.substring(0, 3) || order.status.substring(0, 3)}
                                  </Badge>
                                </div>

                                {org && (
                                  <p className="text-[9px] text-muted-foreground truncate flex items-center gap-1">
                                    <Building2 className="h-2.5 w-2.5" />
                                    {org.name}
                                  </p>
                                )}

                                {order.items && order.items.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {order.items.slice(0, 2).map((item, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className="text-[8px] px-1.5 py-0 font-medium"
                                      >
                                        {item.work_type.replace(/_/g, " ").substring(0, 10)}
                                      </Badge>
                                    ))}
                                    {order.items.length > 2 && (
                                      <Badge variant="secondary" className="text-[8px] px-1.5 py-0">
                                        +{order.items.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center mb-2">
                          <Calendar className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Sin entregas
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
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-400">
                {urgentOrders} {urgentOrders === 1 ? "entrega urgente" : "entregas urgentes"}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Requieren atención en las próximas 48 horas
              </p>
            </div>
            <Link href="/dashboard/orders">
              <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/30">
                Ver Pedidos
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
