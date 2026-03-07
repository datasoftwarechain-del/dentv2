"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatShortDate, formatTime } from "@/lib/date-utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS, STATUS_PIE_COLORS } from "@/lib/order-status";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DeliveryAlerts } from "@/components/dashboard/delivery-alerts";
import {
  Calendar, ArrowRight, TrendingUp, Building2, Package, Clock, CalendarClock,
} from "lucide-react";
import { formatWorkType } from "@/lib/work-types";

interface Patient { id: string; first_name: string; last_name: string; created_at?: string; }
interface Lab { id: string; name: string; }
interface Appointment {
  id: string;
  scheduled_at: string;
  patient: Patient | Patient[] | null;
  notes?: string;
  status?: string;
}
interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  due_date: string | null;
  patient: Patient | Patient[] | null;
  lab_org: Lab | Lab[] | null;
  items?: Array<{ work_type: string; catalog_item: { name: string } | null }> | null;
}

interface DentistDashboardProps {
  orgId: string;
  orgName: string;
  patients: Patient[];
  appointments: Appointment[];
  orders: Order[];
  todayOrders: Order[];
  tomorrowOrders: Order[];
  labs: Lab[];
}

// ── SVG Ring progress ─────────────────────────────────────────────────────────
function RingChart({
  value, max, color, trackColor = "#ffffff18", size = 76, strokeWidth = 7,
}: { value: number; max: number; color: string; trackColor?: string; size?: number; strokeWidth?: number }) {
  const r    = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={`${pct * circ} ${circ}`}
      />
    </svg>
  );
}

function shortDay(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function DentistDashboard({
  orgId, orgName, patients, appointments, orders, todayOrders, tomorrowOrders, labs,
}: DentistDashboardProps) {
  const statusLabels = ORDER_STATUS_LABELS;
  const statusColors = ORDER_STATUS_BADGE_CLASSES;
  const now = new Date();

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const newPatientsThisMonth = patients.filter(p =>
    p.created_at && new Date(p.created_at) >= monthStart
  );

  const todayAppointments = appointments.filter(apt => {
    const d = new Date(apt.scheduled_at);
    return d >= today && d <= todayEnd;
  });

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const upcomingAppointments = appointments.filter(apt => {
    const d = new Date(apt.scheduled_at);
    return d > todayEnd && d <= weekEnd;
  }).slice(0, 5);

  const activeOrders = orders.filter(o =>
    ["received", "in_progress", "ready", "draft", "missing_info", "in_production", "quality_check"].includes(o.status)
  );
  const readyOrders = orders.filter(o => o.status === "ready");

  // ── Top labs used ────────────────────────────────────────────────────────
  const labCounts = useMemo(() => {
    const acc: Record<string, { name: string; count: number }> = {};
    orders.forEach(o => {
      const lab = Array.isArray(o.lab_org) ? o.lab_org[0] : o.lab_org;
      if (lab?.id) {
        acc[lab.id] = acc[lab.id] || { name: lab.name, count: 0 };
        acc[lab.id].count++;
      }
    });
    return Object.values(acc).sort((a, b) => b.count - a.count);
  }, [orders]);

  const topLab = labCounts[0] || null;

  // ── 14-day trend chart ───────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const prefix = d.toISOString().split("T")[0];
      return {
        day:       shortDay(d),
        citas:     appointments.filter(apt => apt.scheduled_at.startsWith(prefix)).length,
        pacientes: patients.filter(p => p.created_at?.startsWith(prefix)).length,
      };
    });
  }, [appointments, patients]);

  // ── Status distribution ──────────────────────────────────────────────────
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    orders.forEach(o => { dist[o.status] = (dist[o.status] || 0) + 1; });
    return Object.entries(dist)
      .filter(([, v]) => v > 0)
      .map(([key, val]) => ({
        name:  statusLabels[key] || key,
        value: val,
        color: STATUS_PIE_COLORS[key] || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [orders, statusLabels]);

  const recentPatients = [...patients]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="flex-1 space-y-5 px-4 py-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Bienvenido, <span className="text-[#09919b]">{orgName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 capitalize">
            {now.toLocaleDateString("es-AR", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <QuickActions organizationId={orgId} patients={patients} labs={labs} />
      </div>

      {/* ── Delivery Alerts ──────────────────────────────────────────────── */}
      {(todayOrders.length > 0 || tomorrowOrders.length > 0) && (
        <DeliveryAlerts todayOrders={todayOrders as any} tomorrowOrders={tomorrowOrders as any} isDentist={true} />
      )}

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Card 1: Total Pacientes — dark teal gradient + ring */}
        <Card className="border-0 bg-gradient-to-br from-[#044c64] to-[#0a6b80] text-white shadow-xl overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.045]" style={{
            backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-[#43eada] opacity-10 blur-2xl" />
          <CardContent className="px-5 py-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Pacientes</p>
              <span className="text-[9px] font-semibold text-[#43eada]/70 bg-[#43eada]/10 border border-[#43eada]/20 rounded-full px-2 py-0.5">
                +{newPatientsThisMonth.length} este mes
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-black leading-none tabular-nums">{patients.length}</p>
                <p className="text-[11px] text-white/40 mt-2.5 font-medium">
                  {newPatientsThisMonth.length} nuevos este mes
                </p>
              </div>
              <div className="relative shrink-0">
                <RingChart
                  value={newPatientsThisMonth.length}
                  max={Math.max(patients.length, 1)}
                  color="#43eada" trackColor="#ffffff12"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-white/60">
                    {patients.length > 0 ? Math.round((newPatientsThisMonth.length / patients.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Citas de Hoy — white + teal ring */}
        <Card className="border border-[#b0dde0] bg-white shadow-sm overflow-hidden relative">
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-[#d2f2f3] opacity-60" />
          <CardContent className="px-5 py-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b]/50">Citas de Hoy</p>
              <span className="text-[9px] font-semibold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] rounded-full px-2 py-0.5">
                {upcomingAppointments.length} próximas
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-black leading-none text-[#044c64] tabular-nums">{todayAppointments.length}</p>
                <p className="text-[11px] text-[#09919b] mt-2.5 font-semibold">
                  {appointments.length} total programadas
                </p>
              </div>
              <div className="relative shrink-0">
                <RingChart
                  value={todayAppointments.length}
                  max={Math.max(appointments.length, 1)}
                  color="#09919b" trackColor="#d2f2f3"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-[#0d687d]">
                    {appointments.length > 0 ? Math.round((todayAppointments.length / appointments.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: En Laboratorio — white + teal ring */}
        <Card className="border border-[#b0dde0] bg-white shadow-sm overflow-hidden relative">
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-[#d2f2f3] opacity-60" />
          <CardContent className="px-5 py-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b]/50">En Laboratorio</p>
              <span className="text-[9px] font-semibold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] rounded-full px-2 py-0.5">
                {readyOrders.length} listos
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-black leading-none text-[#044c64] tabular-nums">{activeOrders.length}</p>
                <p className="text-[11px] text-[#09919b] mt-2.5 font-semibold">
                  {orders.length} órdenes totales
                </p>
              </div>
              <div className="relative shrink-0">
                <RingChart
                  value={activeOrders.length}
                  max={Math.max(orders.length, 1)}
                  color="#09919b" trackColor="#d2f2f3"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-[#0d687d]">
                    {orders.length > 0 ? Math.round((activeOrders.length / orders.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Lab Activo — white + mini bars (parallel to "Cliente Más Activo") */}
        <Card className="border border-[#b0dde0] bg-white shadow-sm overflow-hidden relative">
          <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-[#d2f2f3] opacity-40" />
          <CardContent className="px-5 py-5 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4b8899]/50 mb-3">Lab Principal</p>
            {topLab ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#044c64] leading-tight line-clamp-2">{topLab.name}</p>
                    <p className="text-[11px] text-[#09919b] mt-1 font-semibold">{topLab.count} órdenes</p>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-[#d2f2f3] flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-[#044c64]" />
                  </div>
                </div>
                <div className="space-y-2">
                  {labCounts.slice(0, 3).map((lab, i) => (
                    <div key={lab.name} className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-[#4b8899] w-3 shrink-0">{i + 1}</span>
                      <div className="flex-1 h-[5px] bg-[#d2f2f3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#09919b] rounded-full transition-all"
                          style={{ width: `${(lab.count / (labCounts[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-[#0d687d] w-4 text-right shrink-0">{lab.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <div className="h-12 w-12 rounded-xl bg-[#d2f2f3] flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-[#09919b]" />
                </div>
                <p className="text-sm text-muted-foreground text-center">Sin órdenes aún</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Area chart — 2 cols */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Actividad de la Clínica</CardTitle>
                <CardDescription className="text-[11px]">Últimos 14 días</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-[#09919b] inline-block" />Citas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-[#43eada] inline-block" />Pacientes
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pr-4 pl-1 pb-4">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="dcitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#09919b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#09919b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dpacientes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#43eada" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#43eada" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false} axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false} axisLine={false} allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    fontSize: "11px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Area type="monotone" dataKey="citas"     name="Citas"     stroke="#09919b" strokeWidth={2.5} fill="url(#dcitas)" dot={false} />
                <Area type="monotone" dataKey="pacientes" name="Pacientes" stroke="#43eada" strokeWidth={2.5} fill="url(#dpacientes)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status donut */}
        <Card className="border border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-base font-bold">Estado de Órdenes</CardTitle>
            <CardDescription className="text-[11px]">En laboratorio</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {statusDist.length > 0 ? (
              <>
                <div className="flex justify-center mt-2">
                  <PieChart width={150} height={150}>
                    <Pie
                      data={statusDist} cx={70} cy={70}
                      innerRadius={42} outerRadius={68}
                      paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}
                    >
                      {statusDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    />
                  </PieChart>
                </div>
                <div className="space-y-1.5 mt-1">
                  {statusDist.slice(0, 6).map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[11px] text-muted-foreground font-medium">{s.name}</span>
                      </div>
                      <span className="text-[11px] font-bold text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">
                Sin órdenes aún
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Lists Row ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Próximas Citas — 2 cols */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between py-4 px-5 border-b border-border/40">
            <div>
              <CardTitle className="text-base font-bold">Próximas Citas</CardTitle>
              <CardDescription className="text-[11px]">
                {todayAppointments.length} hoy · {upcomingAppointments.length} próximas esta semana
              </CardDescription>
            </div>
            <Link href="/dashboard/appointments">
              <Button variant="ghost" size="sm" className="text-xs font-bold text-[#09919b] hover:bg-[#d2f2f3] h-8">
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {(todayAppointments.length > 0 || upcomingAppointments.length > 0) ? (
              <div className="divide-y divide-border/40">
                {todayAppointments.slice(0, 3).map((apt) => {
                  const p = Array.isArray(apt.patient) ? apt.patient[0] : apt.patient;
                  const time = new Date(apt.scheduled_at);
                  return (
                    <div key={apt.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-[#d2f2f3] flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4 text-[#044c64]" />
                        </div>
                        <div className="min-w-0">
                          {p && (
                            <p className="text-xs font-semibold text-foreground truncate">
                              {p.first_name} {p.last_name}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {time.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-semibold bg-[#d2f2f3] text-[#044c64] border-[#b0dde0]">
                        HOY
                      </Badge>
                    </div>
                  );
                })}
                {upcomingAppointments.slice(0, 4).map((apt) => {
                  const p = Array.isArray(apt.patient) ? apt.patient[0] : apt.patient;
                  const aptDate = new Date(apt.scheduled_at);
                  return (
                    <div key={apt.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-[#f0fafb] flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4 text-[#09919b]" />
                        </div>
                        <div className="min-w-0">
                          {p && (
                            <p className="text-xs font-semibold text-foreground truncate">
                              {p.first_name} {p.last_name}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {aptDate.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}
                            {" · "}
                            {aptDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No hay citas programadas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pacientes Recientes — dark teal card (parallel to "Clínicas Activas") */}
        <Card className="border-0 bg-gradient-to-b from-[#044c64] to-[#0d687d] text-white shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.06]">
            <TrendingUp className="h-32 w-32" />
          </div>
          <CardHeader className="pb-2 pt-5 px-5 relative z-10">
            <CardTitle className="text-base font-bold text-white">Pacientes Recientes</CardTitle>
            <CardDescription className="text-white/50 text-[11px]">Últimos registrados</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative z-10 space-y-3">
            {recentPatients.length > 0 ? recentPatients.map((patient, i) => (
              <div key={patient.id} className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-white/10 text-[10px] font-black flex items-center justify-center text-white/70 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {patient.first_name} {patient.last_name}
                  </p>
                  {patient.created_at && (
                    <p className="text-[10px] text-white/40">{formatShortDate(patient.created_at)}</p>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-white/40 text-sm">Sin pacientes aún</p>
            )}
            <Link href="/dashboard/patients" className="block pt-3">
              <Button size="sm" variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 text-xs h-8 bg-transparent">
                Ver todos los pacientes <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Orders ─────────────────────────────────────────────────── */}
      <Card className="border border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-5 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold">Órdenes Recientes</CardTitle>
            <CardDescription className="text-[11px]">Trabajos enviados al laboratorio</CardDescription>
          </div>
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-[#09919b] hover:bg-[#d2f2f3] h-8">
              Ver todas <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-border/40">
              {recentOrders.map((order) => {
                const p   = Array.isArray(order.patient) ? order.patient[0] : order.patient;
                const lab = Array.isArray(order.lab_org)  ? order.lab_org[0]  : order.lab_org;
                const firstItem = order.items?.[0];
                const workLabel = firstItem
                  ? (firstItem.catalog_item?.name || formatWorkType(firstItem.work_type))
                  : null;
                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors group"
                  >
                    {/* Left: order # + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] px-2 py-1 rounded-md shrink-0 leading-none">
                        {order.order_number}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        {/* Line 1: patient name + work type chip */}
                        <div className="flex items-center gap-2 min-w-0">
                          {p ? (
                            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                              {p.first_name} {p.last_name}
                            </p>
                          ) : (
                            <p className="text-[13px] font-semibold text-muted-foreground">Sin paciente</p>
                          )}
                          {workLabel && (
                            <span className="hidden sm:inline-flex text-[10px] font-semibold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                              {workLabel}
                            </span>
                          )}
                        </div>
                        {/* Line 2: lab name */}
                        {lab && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                            <Package className="h-2.5 w-2.5 shrink-0" />{lab.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: due date + status */}
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {order.due_date ? (
                        <div className="hidden sm:flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wide">Entrega</span>
                          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                            <CalendarClock className="h-3 w-3 text-muted-foreground" />
                            {formatShortDate(order.due_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="hidden sm:block text-[10px] text-muted-foreground/50">Sin fecha</span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] font-semibold uppercase tracking-wide shrink-0", statusColors[order.status])}
                      >
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No hay órdenes registradas
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
