"use client";

/**
 * [035_design_studio] Dashboard del estudio de diseño.
 *
 * Responde una sola pregunta: ¿qué tengo que hacer ahora?
 *
 * Por eso lo primero no son totales facturados sino las cuatro cosas que
 * piden una acción hoy — por asignar, en diseño, vencidas, esperando al
 * cliente. Un dashboard que abre con "facturaste X este mes" es bonito y
 * no cambia lo que hace nadie a las nueve de la mañana.
 *
 * Las tarjetas son enlaces: si un número pide acción, tiene que poder
 * tocarse y llevar a la lista correspondiente.
 */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useClientNow } from "@/hooks/useClientNow";
import {
  DESIGN_STATUS_BADGE_CLASSES, getDesignStatusLabel, type DesignOrderStatus,
} from "@/lib/design/status";
import { getDesignServiceLabel } from "@/lib/design/services";
import {
  Layers, PenTool, AlertTriangle, Clock, Users, ArrowRight, Plus, TrendingUp, Wallet,
} from "lucide-react";

interface RecentOrder {
  id: string;
  order_number: string;
  status: DesignOrderStatus;
  priority: "normal" | "urgent";
  patient_ref: string | null;
  due_at: string | null;
  client_org: { name: string } | { name: string }[] | null;
  items: { service_code: string }[] | null;
}

interface DesignStudioDashboardProps {
  counts: {
    porAsignar: number;
    enDiseno: number;
    esperandoCliente: number;
    vencidas: number;
    clientesActivos: number;
    sinPrecio: number;
    sinCompletar: number;
    esperandoPago: number;
  };
  facturacion: { mes: number; pendiente: number } | null;
  recientes: RecentOrder[];
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function Tile({
  href, icon: Icon, label, value, tone = "normal", hint,
}: {
  href: string;
  icon: typeof Layers;
  label: string;
  value: number;
  tone?: "normal" | "alert" | "muted";
  hint?: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className={cn(
        "transition-all hover:-translate-y-0.5 hover:shadow-md",
        tone === "alert" && value > 0 && "border-orange-200 bg-orange-50/50",
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <Icon
              className={cn("h-4 w-4",
                tone === "alert" && value > 0 ? "text-orange-600" : "text-[#09919b]")}
              aria-hidden="true"
            />
            <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-[#09919b]" aria-hidden="true" />
          </div>
          <p className={cn("mt-2 text-3xl font-semibold tabular-nums",
            tone === "alert" && value > 0 ? "text-orange-700"
              : tone === "muted" ? "text-slate-400" : "text-[#044c64]")}>
            {value}
          </p>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

export function DesignStudioDashboard({
  counts, facturacion, recientes,
}: DesignStudioDashboardProps) {
  const now = useClientNow();
  const sinTrabajo =
    counts.porAsignar + counts.enDiseno + counts.esperandoCliente === 0;

  return (
    <div className="space-y-6">
      {/* ─── Arrancar ─────────────────────────────────────── */}
      {counts.clientesActivos === 0 ? (
        <Card className="border-[#43eada] bg-[#e0f4f6]/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <h2 className="text-lg font-semibold text-[#044c64]">
              Todavía no tenés clientes
            </h2>
            <p className="max-w-lg text-sm text-[#0d687d]">
              Nadie puede mandarte casos hasta que habilites al primero. Podés darlo
              de alta con su email — si no tiene cuenta, se la creamos.
            </p>
            <Link
              href="/dashboard/design/clients"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#044c64] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#09919b]"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Habilitar el primer cliente
            </Link>
          </CardContent>
        </Card>
      ) : counts.sinPrecio > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="flex-1 text-sm text-amber-900">
              <strong>{counts.sinPrecio}</strong>{" "}
              {counts.sinPrecio === 1 ? "arancel no tiene precio" : "aranceles no tienen precio"}.
              Las órdenes que los usen se facturan en cero y no se nota hasta que llega la factura.
            </p>
            <Link href="/dashboard/settings" className="text-sm font-medium text-amber-900 underline">
              Cargar precios
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Un pedido a medio cargar es una venta a medio cerrar: si no se
          muestra acá, nadie se entera de que existió. */}
      {counts.sinCompletar > 0 && (
        <Card className="border-[#b0dde0] bg-[#e0f4f6]/50">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Clock className="h-4 w-4 shrink-0 text-[#09919b]" aria-hidden="true" />
            <p className="flex-1 text-sm text-[#044c64]">
              <strong>{counts.sinCompletar}</strong>{" "}
              {counts.sinCompletar === 1
                ? "pedido entró sin completar"
                : "pedidos entraron sin completar"}
              : el cliente cargó el caso pero no subió los escaneos.
            </p>
            <Link
              href="/dashboard/design"
              className="text-sm font-medium text-[#044c64] underline"
            >
              Ver cuáles
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ─── Qué hay que hacer ────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
          Tu trabajo de hoy
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            href="/dashboard/design/queue" icon={Layers}
            label="Por asignar" value={counts.porAsignar}
            hint="Casos nuevos esperando diseñador"
          />
          <Tile
            href="/dashboard/design/queue" icon={PenTool}
            label="En diseño" value={counts.enDiseno}
            hint="Trabajo en curso"
          />
          <Tile
            href="/dashboard/design/queue" icon={AlertTriangle}
            label="Vencidas" value={counts.vencidas} tone="alert"
            hint="Pasaron el plazo comprometido"
          />
          <Tile
            href="/dashboard/design" icon={Wallet}
            label="Esperando pago" value={counts.esperandoPago} tone="muted"
            hint="Vendido, todavía sin cobrar"
          />
        </div>
      </div>

      {/* ─── Plata ────────────────────────────────────────── */}
      {facturacion && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Facturado este mes
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#044c64]">
                {formatMoney(facturacion.mes, "USD", { decimals: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Pendiente de cobro
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-700">
                {formatMoney(facturacion.pendiente, "USD", { decimals: 0 })}
              </p>
            </CardContent>
          </Card>
          <Link href="/dashboard/design/clients" className="group">
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Clientes activos
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#044c64]">
                  {counts.clientesActivos}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* ─── Últimas órdenes ──────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-medium text-slate-700">Últimas órdenes</h2>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/design/new"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#09919b] hover:underline">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Nueva
              </Link>
              <Link href="/dashboard/design" className="text-sm text-slate-400 hover:text-[#09919b]">
                Ver todas
              </Link>
            </div>
          </div>

          {recientes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <TrendingUp className="h-7 w-7 text-slate-300" aria-hidden="true" />
              <p className="text-sm text-slate-500">
                {sinTrabajo && counts.clientesActivos > 0
                  ? "Sin casos todavía. Cuando un cliente envíe uno, aparece acá."
                  : "Todavía no hay órdenes."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recientes.map((o) => {
                const client = one(o.client_org);
                const vencida =
                  now !== null && o.due_at && new Date(o.due_at).getTime() < now;
                return (
                  <li key={o.id}>
                    <Link href={`/dashboard/design/${o.id}`}
                      className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#044c64]">{o.order_number}</span>
                          {o.priority === "urgent" && (
                            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                              Urgente
                            </Badge>
                          )}
                          {vencida && (
                            <span className="text-xs font-medium text-red-600">vencida</span>
                          )}
                        </div>
                        <p className="truncate text-sm text-slate-600">
                          {(o.items ?? []).map((i) => getDesignServiceLabel(i.service_code)).join(" · ")
                            || "Sin servicios"}
                        </p>
                        <p className="truncate text-xs text-slate-400">{client?.name ?? "—"}</p>
                      </div>
                      <Badge variant="outline" className={cn(DESIGN_STATUS_BADGE_CLASSES[o.status])}>
                        {getDesignStatusLabel(o.status, "studio")}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
