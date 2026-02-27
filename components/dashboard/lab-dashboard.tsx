"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/date-utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS, STATUS_PIE_COLORS } from "@/lib/order-status";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { DeliveryAlerts } from "@/components/dashboard/delivery-alerts";
import { WorksInProgressList } from "@/app/dashboard/laboratory/components/WorksInProgressList";
import {
  Building2, ArrowRight, TrendingUp,
} from "lucide-react";

interface Patient  { id: string; first_name: string; last_name: string; }
interface Org      { id: string; name: string; }
interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  due_date: string | null;
  patient: Patient | Patient[] | null;
  dentist_org: Org | Org[] | null;
  lab_org?: Org | Org[] | null;
}

interface LabDashboardProps {
  orgId: string;
  orgName: string;
  orders: Order[];
  todayOrders: Order[];
  tomorrowOrders: Order[];
  patients: Patient[];
  dentistOrgs: Org[];
}

// ── SVG Ring progress ────────────────────────────────────────────────────────
function RingChart({
  value, max, color, trackColor = "#ffffff18", size = 84, strokeWidth = 8,
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

// ── Mini sparkline bars ───────────────────────────────────────────────────────
function SparkBars({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{ height: `${Math.max((v / max) * 100, v === 0 ? 10 : 20)}%`, background: color, opacity: v === 0 ? 0.18 : 0.85 }}
        />
      ))}
    </div>
  );
}

function shortDay(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function LabDashboard({
  orgId, orgName, orders, todayOrders, tomorrowOrders, patients, dentistOrgs,
}: LabDashboardProps) {
  const statusLabels = ORDER_STATUS_LABELS;
  const statusColors = ORDER_STATUS_BADGE_CLASSES;
  const now = new Date();

  // ── KPIs ────────────────────────────────────────────────────────────────
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeOrders = orders.filter(o =>
    ["received", "in_progress", "ready",
     "draft", "missing_info", "in_production", "quality_check"].includes(o.status)
  );
  const inProduction = orders.filter(o =>
    ["in_progress", "in_production", "quality_check", "missing_info"].includes(o.status)
  );
  const readyOrders          = orders.filter(o => o.status === "ready");
  const deliveredThisMonth   = orders.filter(o =>
    o.status === "delivered" && new Date(o.created_at) >= monthStart
  );

  // ── Top clients ──────────────────────────────────────────────────────────
  const clientCounts = useMemo(() => {
    const acc: Record<string, { name: string; count: number }> = {};
    orders.forEach(o => {
      const org = Array.isArray(o.dentist_org) ? o.dentist_org[0] : o.dentist_org;
      if (org?.id) {
        acc[org.id] = acc[org.id] || { name: org.name, count: 0 };
        acc[org.id].count++;
      }
    });
    return Object.values(acc).sort((a, b) => b.count - a.count);
  }, [orders]);

  // ── 7-day spark bars (deliveries) ────────────────────────────────────────
  const sparkDeliveries = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const prefix = d.toISOString().split("T")[0];
      return orders.filter(o => o.status === "delivered" && o.created_at.startsWith(prefix)).length;
    });
  }, [orders]);

  // ── 14-day trend chart ───────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const prefix = d.toISOString().split("T")[0];
      return {
        day:        shortDay(d),
        creados:    orders.filter(o => o.created_at.startsWith(prefix)).length,
        entregados: orders.filter(o =>
          o.status === "delivered" && o.created_at.startsWith(prefix)
        ).length,
      };
    });
  }, [orders]);

  // ── Status distribution pie ──────────────────────────────────────────────
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

  // Recent orders — top 6
  const recentOrders = orders.slice(0, 6);
  const topClient    = clientCounts[0] || null;

  return (
    <div className="flex-1 space-y-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola, <span className="text-[#09919b]">{orgName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
            {now.toLocaleDateString("es-AR", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <CreateOrderDialog organizationId={orgId} mode="lab" patients={patients} labs={dentistOrgs} />
      </div>

      {/* ── Delivery Alerts ─────────────────────────────────────────────── */}
      {(todayOrders.length > 0 || tomorrowOrders.length > 0) && (
        <DeliveryAlerts todayOrders={todayOrders as any} tomorrowOrders={tomorrowOrders as any} isDentist={false} />
      )}

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* ── Card 1: Total Órdenes — dark teal + ring gauge ── */}
        <Card className="border-0 bg-gradient-to-br from-[#044c64] to-[#0a6b80] text-white shadow-xl overflow-hidden relative">
          {/* mesh grid bg */}
          <div className="absolute inset-0 opacity-[0.045]" style={{
            backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
          {/* glow blob */}
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-[#43eada] opacity-10 blur-2xl" />
          <CardContent className="px-5 py-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Órdenes</p>
              <span className="text-[9px] font-semibold text-[#43eada]/70 bg-[#43eada]/10 border border-[#43eada]/20 rounded-full px-2 py-0.5">
                {activeOrders.length} activas
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-black leading-none tabular-nums">{orders.length}</p>
                <p className="text-[11px] text-white/40 mt-2.5 font-medium">
                  {activeOrders.length} activas · {readyOrders.length} listas
                </p>
              </div>
              <div className="relative shrink-0">
                <RingChart value={activeOrders.length} max={Math.max(orders.length, 1)} color="#43eada" trackColor="#ffffff12" size={76} strokeWidth={7} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-white/60">
                    {orders.length > 0 ? Math.round((activeOrders.length / orders.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: En Producción — white + teal ring ── */}
        <Card className="border border-[#b0dde0] bg-white shadow-sm overflow-hidden relative">
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-[#d2f2f3] opacity-60" />
          <CardContent className="px-5 py-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b]/50">En Producción</p>
              <span className="text-[9px] font-semibold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] rounded-full px-2 py-0.5">
                {readyOrders.length} listos
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-black leading-none text-[#044c64] tabular-nums">{inProduction.length}</p>
                <p className="text-[11px] text-[#09919b] mt-2.5 font-semibold">
                  {readyOrders.length} listos para entregar
                </p>
              </div>
              <div className="relative shrink-0">
                <RingChart value={inProduction.length} max={Math.max(activeOrders.length, 1)} color="#09919b" trackColor="#d2f2f3" size={76} strokeWidth={7} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-[#0d687d]">
                    {activeOrders.length > 0 ? Math.round((inProduction.length / activeOrders.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 3: Entregados mes — white + spark bars ── */}
        <Card className="border border-emerald-200 bg-white shadow-sm overflow-hidden relative">
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-emerald-50 opacity-80" />
          <CardContent className="px-5 py-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Entregados (mes)</p>
              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 capitalize">
                {now.toLocaleDateString("es-AR", { month: "short" })}
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-5xl font-black leading-none text-emerald-700 tabular-nums">{deliveredThisMonth.length}</p>
                <p className="text-[11px] text-emerald-500/70 mt-2.5 font-medium">Últimos 7 días</p>
              </div>
              <div className="flex-1 pb-0.5">
                <SparkBars data={sparkDeliveries} color="#10b981" height={40} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 4: Cliente Más Activo — white + mini leaderboard bars ── */}
        <Card className="border border-[#b0dde0] bg-white shadow-sm overflow-hidden relative">
          <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-[#d2f2f3] opacity-40" />
          <CardContent className="px-5 py-5 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4b8899]/50 mb-3">Cliente Más Activo</p>
            {topClient ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#044c64] leading-tight line-clamp-2">{topClient.name}</p>
                    <p className="text-[11px] text-[#09919b] mt-1 font-semibold">{topClient.count} órdenes</p>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-[#d2f2f3] flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-[#044c64]" />
                  </div>
                </div>
                <div className="space-y-2">
                  {clientCounts.slice(0, 3).map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-[#4b8899] w-3 shrink-0">{i + 1}</span>
                      <div className="flex-1 h-[5px] bg-[#d2f2f3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#09919b] rounded-full transition-all"
                          style={{ width: `${(c.count / (clientCounts[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-[#0d687d] w-4 text-right shrink-0">{c.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Area chart — 2 cols */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Actividad de Pedidos</CardTitle>
                <CardDescription className="text-[11px]">Últimos 14 días</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-[#09919b] inline-block" />Creados
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-[#43eada] inline-block" />Entregados
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pr-4 pl-1 pb-4">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gcreados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#09919b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#09919b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gentregados" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="creados"    name="Creados"    stroke="#09919b" strokeWidth={2.5} fill="url(#gcreados)" dot={false} />
                <Area type="monotone" dataKey="entregados" name="Entregados" stroke="#43eada" strokeWidth={2.5} fill="url(#gentregados)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status donut */}
        <Card className="border border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-base font-bold">Estado de Órdenes</CardTitle>
            <CardDescription className="text-[11px]">Distribución actual</CardDescription>
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
                Sin datos aún
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Orders + Client Leaderboard ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Recent orders — 2 cols */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between py-4 px-5 border-b border-border/40">
            <div>
              <CardTitle className="text-base font-bold">Órdenes Recientes</CardTitle>
              <CardDescription className="text-[11px]">Últimas órdenes registradas</CardDescription>
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
                  const p   = Array.isArray(order.patient)     ? order.patient[0]     : order.patient;
                  const org = Array.isArray(order.dentist_org) ? order.dentist_org[0] : order.dentist_org;
                  return (
                    <Link
                      key={order.id}
                      href={`/dashboard/orders/${order.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-[#0d687d] bg-[#d2f2f3] border border-[#b0dde0] px-2 py-0.5 rounded-md shrink-0">
                          {order.order_number}
                        </span>
                        <div className="min-w-0">
                          {p && (
                            <p className="text-xs font-semibold text-foreground truncate">
                              {p.first_name} {p.last_name}
                            </p>
                          )}
                          {org && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                              <Building2 className="h-2.5 w-2.5 shrink-0" />{org.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:block">
                          {formatShortDate(order.created_at)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[9px] font-semibold uppercase tracking-wide", statusColors[order.status])}
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

        {/* Client leaderboard */}
        <Card className="border-0 bg-gradient-to-b from-[#044c64] to-[#0d687d] text-white shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.06]">
            <TrendingUp className="h-32 w-32" />
          </div>
          <CardHeader className="pb-2 pt-5 px-5 relative z-10">
            <CardTitle className="text-base font-bold text-white">Clínicas Activas</CardTitle>
            <CardDescription className="text-white/50 text-[11px]">Por volumen de pedidos</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative z-10 space-y-3">
            {clientCounts.length > 0 ? clientCounts.slice(0, 5).map((client, i) => (
              <div key={client.name} className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-white/10 text-[10px] font-black flex items-center justify-center text-white/70 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{client.name}</p>
                  <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-[#43eada] rounded-full transition-all"
                      style={{ width: `${(client.count / (clientCounts[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-[#43eada] shrink-0">{client.count}</span>
              </div>
            )) : (
              <p className="text-white/40 text-sm">Sin clientes aún</p>
            )}
            <Link href="/dashboard/clients" className="block pt-3">
              <Button size="sm" variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 text-xs h-8 bg-transparent">
                Ver todas las clínicas <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Works in Progress ───────────────────────────────────────────── */}
      <WorksInProgressList orgId={orgId} />
    </div>
  );
}
