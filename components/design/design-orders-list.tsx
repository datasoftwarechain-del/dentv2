"use client";

/**
 * [035_design_studio] Listado de órdenes de diseño.
 *
 * Sirve a los dos lados del mostrador con la misma tabla. Lo único que
 * cambia es la contraparte que se muestra (cliente o estudio) y que al
 * cliente se le nombran los estados con el vocabulario suyo: no le
 * importa si el caso está "asignado" o "en control interno".
 *
 * El orden por defecto pone arriba lo que espera una acción de quien
 * mira: una orden trabada en "Faltan datos" no debería quedar sepultada
 * bajo veinte entregadas.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DESIGN_STATUS_BADGE_CLASSES,
  DESIGN_STATUS_ACTIVE,
  getDesignStatusLabel,
  isAwaitingClient,
  type DesignOrderStatus,
} from "@/lib/design/status";
import { getDesignServiceLabel } from "@/lib/design/services";
import { PenTool, Search, AlertCircle, Clock } from "lucide-react";

interface ListRow {
  id: string;
  order_number: string;
  status: DesignOrderStatus;
  priority: "normal" | "urgent";
  patient_ref: string | null;
  due_at: string | null;
  created_at: string;
  revision_count: number;
  studio_org_id: string;
  client_org_id: string;
  client_org: { id: string; name: string } | { id: string; name: string }[] | null;
  studio_org: { id: string; name: string } | { id: string; name: string }[] | null;
  items: { service_code: string; quantity: number }[] | null;
}

interface DesignOrdersListProps {
  orders: ListRow[];
  isStudio: boolean;
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function DesignOrdersList({ orders, isStudio }: DesignOrdersListProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "all">("active");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders
      .filter((o) => (tab === "active" ? DESIGN_STATUS_ACTIVE.includes(o.status) : true))
      .filter((o) => {
        if (!term) return true;
        const counterpart = one(isStudio ? o.client_org : o.studio_org)?.name ?? "";
        return (
          o.order_number.toLowerCase().includes(term) ||
          (o.patient_ref ?? "").toLowerCase().includes(term) ||
          counterpart.toLowerCase().includes(term)
        );
      });
  }, [orders, search, tab, isStudio]);

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <PenTool className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="font-medium text-slate-700">Todavía no hay órdenes de diseño</p>
          <p className="max-w-sm text-sm text-slate-500">
            {isStudio
              ? "Cuando un cliente envíe un caso, va a aparecer acá."
              : "Pedí tu primer diseño y seguí acá cómo avanza."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "all")}>
          <TabsList>
            <TabsTrigger value="active">En curso</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:w-72">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isStudio ? "Nº, referencia o cliente" : "Nº, referencia o estudio"}
            className="pl-9"
            aria-label="Buscar órdenes"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            No hay órdenes que coincidan con la búsqueda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {rows.map((order) => {
                const counterpart = one(isStudio ? order.client_org : order.studio_org);
                const services = (order.items ?? [])
                  .map((i) => getDesignServiceLabel(i.service_code))
                  .join(" · ");

                // "Te toca a vos": la orden espera una acción de quien mira.
                const needsMe = isStudio
                  ? !isAwaitingClient(order.status)
                  : isAwaitingClient(order.status);

                return (
                  <li key={order.id}>
                    <Link
                      href={`/dashboard/design/${order.id}`}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[#044c64]">{order.order_number}</span>
                          {order.priority === "urgent" && (
                            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                              Urgente
                            </Badge>
                          )}
                          {order.revision_count > 0 && (
                            <span className="text-xs text-slate-400">
                              {order.revision_count} {order.revision_count === 1 ? "revisión" : "revisiones"}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-slate-600">
                          {services || "Sin servicios cargados"}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {counterpart?.name ?? "—"}
                          {order.patient_ref ? ` · ${order.patient_ref}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4">
                        {order.due_at && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {formatDate(order.due_at)}
                          </span>
                        )}

                        {needsMe && (
                          <AlertCircle
                            className="h-4 w-4 text-[#09919b]"
                            aria-label="Esperando una acción tuya"
                          />
                        )}

                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0",
                            DESIGN_STATUS_BADGE_CLASSES[order.status],
                          )}
                        >
                          {getDesignStatusLabel(order.status, isStudio ? "studio" : "client")}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
