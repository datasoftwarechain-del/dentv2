"use client";

/**
 * [035_design_studio] Tablero del estudio.
 *
 * Cada número viaja con su tamaño de muestra. Un 100% de puntualidad
 * sobre 2 órdenes no es lo mismo que sobre 200, y una tarjeta que muestra
 * solo el porcentaje invita a decidir sobre ruido. Cuando la muestra es
 * chica la tarjeta lo dice en vez de disimularlo.
 *
 * Los tiempos son MEDIANA, no promedio: un caso que quedó olvidado tres
 * semanas corre el promedio lo suficiente como para que deje de describir
 * a ningún caso real.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  Measure, ServiceBreakdown, DesignerBreakdown, StudioTotals,
} from "@/lib/design/metrics";
import { formatMoney } from "@/lib/money";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface DesignAnalyticsProps {
  totals: StudioTotals;
  turnaround: Measure;
  delivery: Measure;
  onTime: Measure;
  needsInfo: Measure;
  revisions: Measure;
  byService: ServiceBreakdown[];
  byDesigner: Array<DesignerBreakdown & { name: string }>;
  showAmounts: boolean;
}

/** Por debajo de esto el número no sostiene una decisión. */
const THIN_SAMPLE = 5;

// El estudio vende afuera: sus números van en dólares. Sin decimales
// porque son agregados — los centavos de un total anual son ruido.
function money(value: number): string {
  return formatMoney(value, "USD", { decimals: 0 });
}

function MetricCard({
  label, measure, format, hint, invert = false,
}: {
  label: string;
  measure: Measure;
  format: (v: number) => string;
  hint?: string;
  /** true = más alto es peor (tasa de faltantes, revisiones). */
  invert?: boolean;
}) {
  const thin = measure.sample > 0 && measure.sample < THIN_SAMPLE;

  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>

        {measure.sample === 0 ? (
          <>
            <p className="text-2xl font-semibold text-slate-300">—</p>
            <p className="text-xs text-slate-400">Todavía sin datos</p>
          </>
        ) : (
          <>
            <p
              className={cn(
                "text-2xl font-semibold",
                invert ? "text-slate-800" : "text-[#044c64]",
              )}
            >
              {format(measure.value)}
            </p>
            <p className={cn("text-xs", thin ? "text-amber-600" : "text-slate-400")}>
              {thin && "⚠ "}
              sobre {measure.sample} {measure.sample === 1 ? "orden" : "órdenes"}
              {thin && " — muestra chica"}
            </p>
          </>
        )}

        {hint && <p className="pt-1 text-xs text-slate-400">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DesignAnalytics({
  totals, turnaround, delivery, onTime, needsInfo, revisions,
  byService, byDesigner, showAmounts,
}: DesignAnalyticsProps) {
  if (totals.orders === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <TrendingUp className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="font-medium text-slate-700">Todavía no hay órdenes para medir</p>
          <p className="max-w-sm text-sm text-slate-500">
            Los números aparecen en cuanto entren los primeros casos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const costlessService = byService.some((s) => s.itemsWithoutCost > 0);

  return (
    <div className="space-y-6">
      {/* ─── Operación ────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Entrega inicial"
          measure={turnaround}
          format={(v) => `${v} h`}
          hint="Mediana desde que entra hasta la primera entrega."
        />
        <MetricCard
          label="Puntualidad"
          measure={onTime}
          format={(v) => `${v}%`}
          hint="Primeras entregas dentro del plazo comprometido."
        />
        <MetricCard
          label="Faltan datos"
          measure={needsInfo}
          format={(v) => `${v}%`}
          invert
          hint="Casos que hubo que devolver al cliente."
        />
        <MetricCard
          label="Revisiones"
          measure={revisions}
          format={(v) => String(v)}
          invert
          hint="Vueltas promedio por orden entregada."
        />
        <MetricCard
          label="Liberación"
          measure={delivery}
          format={(v) => `${v} h`}
          hint="Mediana desde la aprobación hasta entregar archivos."
        />
      </div>

      {/* ─── Dinero ───────────────────────────────────────── */}
      {showAmounts && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Facturado</p>
              <p className="text-2xl font-semibold text-[#044c64]">{money(totals.revenue)}</p>
              <p className="text-xs text-slate-400">{totals.orders} órdenes</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Costo de diseño</p>
              <p className="text-2xl font-semibold text-slate-700">{money(totals.cost)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Margen</p>
              <p className="text-2xl font-semibold text-emerald-700">{money(totals.margin)}</p>
              {costlessService && (
                <p className="flex items-start gap-1 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  Hay líneas sin costo cargado: el margen está inflado.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Cargos por revisión
              </p>
              <p className="text-2xl font-semibold text-slate-700">
                {money(totals.revisionRevenue)}
              </p>
              <p className="text-xs text-slate-400">
                Lo que costó el ida y vuelta, facturado aparte.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Por servicio ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por servicio</CardTitle>
          <CardDescription>Qué se pide más y cuánto deja cada cosa.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-2 font-medium">Servicio</th>
                  <th className="px-3 py-2 text-right font-medium">Órdenes</th>
                  <th className="px-3 py-2 text-right font-medium">Unid.</th>
                  <th className="px-3 py-2 text-right font-medium">Rev.</th>
                  {showAmounts && <th className="px-3 py-2 text-right font-medium">Facturado</th>}
                  {showAmounts && <th className="px-6 py-2 text-right font-medium">Margen</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byService.map((row) => (
                  <tr key={row.serviceCode}>
                    <td className="px-6 py-2.5 text-slate-700">
                      {row.label}
                      {row.itemsWithoutCost > 0 && showAmounts && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-amber-200 bg-amber-50 text-amber-700"
                        >
                          {row.itemsWithoutCost} sin costo
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{row.orders}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{row.units}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right",
                        row.avgRevisions >= 2 ? "font-medium text-orange-700" : "text-slate-500",
                      )}
                    >
                      {row.avgRevisions}
                    </td>
                    {showAmounts && (
                      <td className="px-3 py-2.5 text-right text-slate-700">{money(row.revenue)}</td>
                    )}
                    {showAmounts && (
                      <td className="px-6 py-2.5 text-right text-slate-700">{money(row.margin)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Por diseñador ────────────────────────────────── */}
      {byDesigner.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por diseñador</CardTitle>
            <CardDescription>
              Solo las órdenes asignadas. Las que no tienen dueño no se reparten.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-2 font-medium">Diseñador</th>
                    <th className="px-3 py-2 text-right font-medium">Órdenes</th>
                    <th className="px-3 py-2 text-right font-medium">Entrega</th>
                    <th className="px-3 py-2 text-right font-medium">Rev.</th>
                    {showAmounts && <th className="px-6 py-2 text-right font-medium">Margen</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {byDesigner.map((row) => (
                    <tr key={row.userId}>
                      <td className="px-6 py-2.5 text-slate-700">{row.name}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{row.orders}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        {row.medianTurnaroundHours > 0 ? `${row.medianTurnaroundHours} h` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{row.avgRevisions}</td>
                      {showAmounts && (
                        <td className="px-6 py-2.5 text-right text-slate-700">{money(row.margin)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
