"use client";

import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatDueTime, isOverdue } from "@/lib/date-utils";
import { Clock, Calendar, Bell, ChevronRight, User, Building2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Patient { id: string; first_name: string; last_name: string; }
interface Organization { id: string; name: string; }
interface Order {
  id: string;
  order_number: string;
  status: string;
  due_date: string;
  patient: Patient | Patient[] | null;
  dentist_org: Organization | Organization[] | null;
  lab_org: Organization | Organization[] | null;
}
interface DeliveryAlertsProps {
  todayOrders: Order[];
  tomorrowOrders: Order[];
  isDentist: boolean;
}

function OrderRow({ order, isDentist, isToday }: { order: Order; isDentist: boolean; isToday: boolean }) {
  const patient = Array.isArray(order.patient) ? order.patient[0] : order.patient;
  const orgData = isDentist ? order.lab_org : order.dentist_org;
  const org = Array.isArray(orgData) ? orgData[0] : orgData;
  const overdue = isToday && isOverdue(order.due_date);
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;

  return (
    <Link href={`/dashboard/orders/${order.id}`}>
      <div className={cn(
        "group relative flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer border",
        overdue
          ? "bg-destructive/[0.04] border-destructive/20 hover:bg-destructive/[0.08]"
          : "bg-white/60 border-[#d2f2f3]/80 hover:bg-[#f0fafb] hover:border-[#b0dde0]"
      )}>
        {/* Left accent line */}
        <div className={cn(
          "absolute left-0 top-3 bottom-3 w-[3px] rounded-full",
          overdue ? "bg-destructive" : "bg-gradient-to-b from-[#09919b] to-[#044c64]"
        )} />

        <div className="flex-1 min-w-0 pl-1">
          <div className="flex items-center gap-2.5 mb-1">
            <span className={cn(
              "font-bold text-sm tracking-wide",
              overdue ? "text-destructive" : "text-[#044c64]"
            )}>
              {order.order_number}
            </span>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
              ORDER_STATUS_BADGE_CLASSES[order.status] || "bg-muted text-muted-foreground border-border"
            )}>
              {statusLabel}
            </span>
            {overdue && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Atrasado
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {patient && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <User className="h-3 w-3 text-[#09919b]" />
                {patient.first_name} {patient.last_name}
              </span>
            )}
            {org && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3 text-[#09919b]" />
                {org.name}
              </span>
            )}
          </div>
        </div>

        {/* Time */}
        <div className={cn(
          "flex items-center gap-1.5 font-black text-xl tabular-nums shrink-0 tracking-tight",
          overdue ? "text-destructive" : "text-[#044c64]"
        )}>
          {isToday ? <Clock className="h-4 w-4 shrink-0" /> : <Calendar className="h-4 w-4 shrink-0" />}
          {formatDueTime(order.due_date)}
        </div>
      </div>
    </Link>
  );
}

function AlertSection({
  icon: Icon,
  title,
  subtitle,
  count,
  linkHref,
  linkLabel,
  accentFrom,
  accentTo,
  glowColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  count: number;
  linkHref: string;
  linkLabel: string;
  accentFrom: string;
  accentTo: string;
  glowColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d2f2f3] bg-white shadow-sm">
      {/* Gradient glow orb — top right corner, inspired by reference */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full blur-2xl opacity-30"
        style={{ background: glowColor }}
      />
      {/* Top gradient bar */}
      <div className={cn("h-[3px] w-full bg-gradient-to-r", accentFrom, accentTo)} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3.5">
          {/* Icon circle — inspired by reference photo */}
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#b0dde0] bg-gradient-to-br from-[#f0fafb] to-white shadow-inner shrink-0">
            <Icon className="h-5 w-5 text-[#09919b]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-[#044c64] leading-none">{title}</h3>
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#044c64] text-white text-[10px] font-black">
                {count}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Link href={linkHref}>
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#09919b] hover:text-[#044c64] transition-colors">
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      {/* Order rows */}
      <div className="px-4 pb-4 space-y-2">
        {children}
      </div>
    </div>
  );
}

export function DeliveryAlerts({ todayOrders, tomorrowOrders, isDentist }: DeliveryAlertsProps) {
  if (todayOrders.length === 0 && tomorrowOrders.length === 0) return null;

  return (
    <div className="space-y-3">
      {todayOrders.length > 0 && (
        <AlertSection
          icon={Clock}
          title="Entregas de hoy"
          subtitle={`${todayOrders.length === 1 ? "trabajo pendiente" : "trabajos pendientes"} para hoy`}
          count={todayOrders.length}
          linkHref="/dashboard/orders"
          linkLabel="Ver todos"
          accentFrom="from-[#044c64]"
          accentTo="via-[#09919b] to-transparent"
          glowColor="radial-gradient(circle, #09919b 0%, transparent 70%)"
        >
          {todayOrders.slice(0, 3).map((o) => (
            <OrderRow key={o.id} order={o} isDentist={isDentist} isToday />
          ))}
          {todayOrders.length > 3 && (
            <Link href="/dashboard/orders">
              <p className="text-center text-[11px] text-[#09919b] font-semibold pt-1 hover:underline cursor-pointer">
                + {todayOrders.length - 3} entregas más hoy
              </p>
            </Link>
          )}
        </AlertSection>
      )}

      {tomorrowOrders.length > 0 && (
        <AlertSection
          icon={Bell}
          title="Entregas de mañana"
          subtitle={`${tomorrowOrders.length === 1 ? "trabajo programado" : "trabajos programados"}`}
          count={tomorrowOrders.length}
          linkHref="/dashboard/schedule"
          linkLabel="Ver agenda"
          accentFrom="from-[#09919b]/60"
          accentTo="via-[#044c64]/30 to-transparent"
          glowColor="radial-gradient(circle, #044c64 0%, transparent 70%)"
        >
          {tomorrowOrders.slice(0, 3).map((o) => (
            <OrderRow key={o.id} order={o} isDentist={isDentist} isToday={false} />
          ))}
          {tomorrowOrders.length > 3 && (
            <Link href="/dashboard/schedule">
              <p className="text-center text-[11px] text-[#09919b] font-semibold pt-1 hover:underline cursor-pointer">
                + {tomorrowOrders.length - 3} entregas más mañana
              </p>
            </Link>
          )}
        </AlertSection>
      )}
    </div>
  );
}
