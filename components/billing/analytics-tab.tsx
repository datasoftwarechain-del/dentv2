"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Loader2, BarChart3, Trophy, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import { formatWorkType } from "@/lib/work-types";
import { Badge } from "@/components/ui/badge";

interface InvoiceLite {
  id: string;
  total?: number;
  created_at: string;
  dentist_org?: { id: string; name: string } | null;
  order_items?: { work_type?: string; quantity?: number; unit_price?: number | null; selected_extras?: { price: number; qty?: number }[] }[];
}

interface PurchaseLite {
  id: string;
  total?: number;
  purchase_date: string;
}

interface Props {
  invoices: InvoiceLite[];
  /** [BLOQUE 6] Driven by view_billing_amounts. Without it, charts/numbers hidden. */
  canViewAmounts?: boolean;
}

const MONTHS_TO_SHOW = 6;

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonths(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${monthNames[parseInt(m) - 1]} '${y.slice(2)}`;
}

export function AnalyticsTab({ invoices, canViewAmounts = false }: Props) {
  const [purchases, setPurchases] = useState<PurchaseLite[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/purchases")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (!cancelled) setPurchases(data.items ?? []); })
      .catch(() => { if (!cancelled) setPurchases([]); })
      .finally(() => { if (!cancelled) setLoadingPurchases(false); });
    return () => { cancelled = true; };
  }, []);

  const monthsData = useMemo(() => {
    const months = recentMonths();
    const map: Record<string, { facturado: number; comprado: number }> = {};
    for (const k of months) map[k] = { facturado: 0, comprado: 0 };

    for (const inv of invoices) {
      const k = monthKey(inv.created_at);
      if (map[k] && canViewAmounts) map[k].facturado += Number(inv.total ?? 0);
    }
    for (const p of purchases) {
      const k = monthKey(p.purchase_date);
      if (map[k] && canViewAmounts) map[k].comprado += Number(p.total ?? 0);
    }
    return months.map((k) => ({
      month: monthLabel(k),
      Facturado: map[k].facturado,
      Comprado: map[k].comprado,
    }));
  }, [invoices, purchases, canViewAmounts]);

  const topClients = useMemo(() => {
    if (!canViewAmounts) return [] as { id: string; name: string; total: number }[];
    const m = new Map<string, { id: string; name: string; total: number }>();
    for (const inv of invoices) {
      const c = inv.dentist_org;
      if (!c) continue;
      const cur = m.get(c.id) ?? { id: c.id, name: c.name, total: 0 };
      cur.total += Number(inv.total ?? 0);
      m.set(c.id, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [invoices, canViewAmounts]);

  const topWorks = useMemo(() => {
    const m = new Map<string, { work_type: string; count: number }>();
    for (const inv of invoices) {
      for (const it of inv.order_items ?? []) {
        const wt = it.work_type ?? "(sin tipo)";
        const cur = m.get(wt) ?? { work_type: wt, count: 0 };
        cur.count += Number(it.quantity ?? 1);
        m.set(wt, cur);
      }
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [invoices]);

  const totalFacturado = monthsData.reduce((s, m) => s + m.Facturado, 0);
  const totalComprado  = monthsData.reduce((s, m) => s + m.Comprado, 0);
  const margenBruto = totalFacturado - totalComprado;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-widest font-bold">Facturado (últimos {MONTHS_TO_SHOW}m)</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-[#044c64]">
              {canViewAmounts ? `$${formatNumber(totalFacturado)}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-widest font-bold">Comprado (últimos {MONTHS_TO_SHOW}m)</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-[#09919b]">
              {canViewAmounts ? `$${formatNumber(totalComprado)}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Ganancia bruta
            </CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${margenBruto >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {canViewAmounts ? `$${formatNumber(margenBruto)}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Mes a mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Facturado vs Comprado — últimos {MONTHS_TO_SHOW} meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canViewAmounts ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Necesitás el permiso <code className="font-mono">view_billing_amounts</code> para ver los montos del gráfico.
            </p>
          ) : loadingPurchases ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={monthsData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => `$${formatNumber(Number(value) || 0)}`}
                    labelStyle={{ color: "#044c64", fontWeight: 700 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Facturado" fill="#044c64" />
                  <Bar dataKey="Comprado"  fill="#09919b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top 5 clientes por facturación
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canViewAmounts ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin permiso para ver montos.
              </p>
            ) : topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin datos en el período.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {topClients.map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] font-bold shrink-0">{i + 1}</Badge>
                      <span className="truncate font-medium text-sm">{c.name}</span>
                    </div>
                    <span className="tabular-nums font-bold text-sm text-[#044c64] shrink-0">
                      ${formatNumber(c.total)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Top trabajos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-emerald-500" />
              Top 5 tipos de trabajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topWorks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin trabajos registrados.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {topWorks.map((w, i) => (
                  <li key={w.work_type} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] font-bold shrink-0">{i + 1}</Badge>
                      <span className="truncate font-medium text-sm">{formatWorkType(w.work_type)}</span>
                    </div>
                    <span className="tabular-nums font-bold text-sm text-[#09919b] shrink-0">
                      {w.count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
