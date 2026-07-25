"use client";

// ============================================================
// ProfitabilityTab (BLOQUE 7 — Rentabilidad)
// ============================================================
// Pestaña EXTRA en facturación. Autocontenida: obtiene sus datos de
// /api/costs/summary y /api/costs/catalog. No modifica ningún flujo
// existente. Los endpoints ya aplican el gating de roles server-side;
// el componente solo se monta si el usuario tiene view_financial_dashboard.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Coins, Percent, AlertTriangle, Save, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import { toast } from "sonner";
import { useCSRF } from "@/hooks/useCSRF";

interface KPIs {
  revenue: number;
  productionCost: number;
  margin: number;
  marginPct: number;
  invoiceCount: number;
  itemsTotal: number;
  itemsWithoutCost: number;
}
interface WorkRow {
  label: string;
  qty: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}
interface MonthRow {
  month: string;
  revenue: number;
  cost: number;
  margin: number;
}
interface Summary {
  monthsWindow: number;
  kpis: KPIs;
  byWorkType: WorkRow[];
  byMonth: MonthRow[];
}
interface CatalogRow {
  id: string;
  category: string;
  name: string;
  base_price: number;
  unit_cost: number;
  is_active: boolean;
}

export function ProfitabilityTab() {
  const { csrfToken } = useCSRF();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSummary = () => {
    setLoadingSummary(true);
    fetch("/api/costs/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: Summary) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/costs/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: Summary) => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setSummary(null); })
      .finally(() => { if (!cancelled) setLoadingSummary(false); });

    fetch("/api/costs/catalog")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { items: CatalogRow[]; canManage: boolean }) => {
        if (cancelled) return;
        setCatalog(data.items ?? []);
        setCanManage(!!data.canManage);
      })
      .catch(() => { if (!cancelled) setCatalog([]); })
      .finally(() => { if (!cancelled) setLoadingCatalog(false); });

    return () => { cancelled = true; };
  }, []);

  const saveCost = async (row: CatalogRow) => {
    const raw = drafts[row.id];
    if (raw === undefined) return;
    const value = Number(raw);
    if (isNaN(value) || value < 0) {
      toast.error("El costo debe ser un número ≥ 0");
      return;
    }
    setSavingId(row.id);
    try {
      const res = await fetch("/api/costs/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ id: row.id, unit_cost: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo guardar");
      }
      setCatalog((prev) => prev.map((c) => (c.id === row.id ? { ...c, unit_cost: value } : c)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      toast.success(`Costo de "${row.name}" actualizado`);
      loadSummary(); // recalcular márgenes con el nuevo costo
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingId(null);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, CatalogRow[]>();
    for (const row of catalog) {
      if (!row.is_active) continue;
      const arr = m.get(row.category) ?? [];
      arr.push(row);
      m.set(row.category, arr);
    }
    return Array.from(m.entries());
  }, [catalog]);

  const k = summary?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <div>
          <h3 className="text-base font-semibold">Rentabilidad de producción</h3>
          <p className="text-sm text-muted-foreground">
            Cruza lo facturado contra el costo de producción de cada arancel para ver la ganancia real.
          </p>
        </div>
      </div>

      {/* KPIs */}
      {loadingSummary ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No se pudieron cargar los datos de rentabilidad.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase tracking-widest font-bold">
                  Facturado ({summary.monthsWindow}m)
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums text-[#044c64]">
                  ${formatNumber(k!.revenue)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3" /> Costo de producción
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums text-[#09919b]">
                  ${formatNumber(k!.productionCost)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Ganancia estimada
                </CardDescription>
                <CardTitle className={`text-2xl tabular-nums ${k!.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  ${formatNumber(k!.margin)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Margen
                </CardDescription>
                <CardTitle className={`text-2xl tabular-nums ${k!.marginPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {k!.marginPct}%
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Aviso de cobertura de costos */}
          {k!.itemsWithoutCost > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300">
                {k!.itemsWithoutCost} de {k!.itemsTotal} ítems facturados no tienen costo cargado.
                La ganancia estimada es <strong>parcial</strong> hasta que completes sus costos en la tabla de abajo.
              </span>
            </div>
          )}

          {/* Mes a mes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Facturado · Costo · Margen — últimos {summary.monthsWindow} meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={summary.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => `$${formatNumber(Number(value) || 0)}`}
                      labelStyle={{ color: "#044c64", fontWeight: 700 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Facturado" fill="#044c64" />
                    <Bar dataKey="cost" name="Costo" fill="#09919b" />
                    <Bar dataKey="margin" name="Margen" fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Margen por tipo de trabajo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Margen por tipo de trabajo</CardTitle>
              <CardDescription>Ordenado por ganancia acumulada en el período.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.byWorkType.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin trabajos facturados en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trabajo</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Ingreso</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.byWorkType.map((w) => (
                        <TableRow key={w.label}>
                          <TableCell className="font-medium">{w.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{w.qty}</TableCell>
                          <TableCell className="text-right tabular-nums">${formatNumber(w.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums text-[#09919b]">${formatNumber(w.cost)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold ${w.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            ${formatNumber(w.margin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <Badge variant="outline" className={w.marginPct >= 0 ? "text-emerald-600" : "text-rose-600"}>
                              {w.marginPct}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Editor de costos por arancel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costo de producción por arancel</CardTitle>
          <CardDescription>
            {canManage
              ? "Cargá cuánto te cuesta producir cada ítem (materiales + mano de obra). El margen se recalcula al guardar."
              : "Necesitás el permiso de gestión de aranceles (manage_pricing) para editar los costos."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCatalog ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay aranceles activos en el catálogo.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([category, rows]) => (
                <div key={category}>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">{category}</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Arancel</TableHead>
                          <TableHead className="text-right">Precio venta</TableHead>
                          <TableHead className="text-right w-40">Costo producción</TableHead>
                          <TableHead className="text-right">Margen unit.</TableHead>
                          {canManage && <TableHead className="w-24" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const draft = drafts[row.id];
                          const currentCost = draft !== undefined ? Number(draft) || 0 : row.unit_cost;
                          const unitMargin = Number(row.base_price) - currentCost;
                          const dirty = draft !== undefined && Number(draft) !== row.unit_cost;
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-right tabular-nums">${formatNumber(Number(row.base_price))}</TableCell>
                              <TableCell className="text-right">
                                {canManage ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    inputMode="decimal"
                                    className="h-8 text-right tabular-nums ml-auto max-w-[9rem]"
                                    value={draft !== undefined ? draft : String(row.unit_cost)}
                                    onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveCost(row); }}
                                  />
                                ) : (
                                  <span className="tabular-nums">${formatNumber(Number(row.unit_cost))}</span>
                                )}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums font-semibold ${unitMargin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                ${formatNumber(unitMargin)}
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant={dirty ? "default" : "ghost"}
                                    disabled={!dirty || savingId === row.id}
                                    onClick={() => saveCost(row)}
                                  >
                                    {savingId === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Save className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
