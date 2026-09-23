"use client";

/**
 * [035_design_studio] Tablero de la cola del estudio.
 *
 * Una columna por etapa de trabajo. La columna "Con el cliente" está a
 * propósito: es trabajo que salió de las manos del estudio y que no hay
 * que empujar, pero que igual ocupa lugar en el compromiso de plazo.
 *
 * Las cartas muestran el vencimiento y se ponen en rojo cuando ya pasó.
 * Es la única señal del tablero que pide una reacción inmediata, así que
 * no compite con ninguna otra.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DESIGN_KANBAN_COLUMNS } from "@/lib/design/status";
import { getDesignServiceLabel } from "@/lib/design/services";
import { changeDesignOrderStatus } from "@/lib/design/client-api";
import { toast } from "sonner";
import { useClientNow } from "@/hooks/useClientNow";
import { Clock, UserPlus, Loader2, AlertTriangle } from "lucide-react";

interface QueueOrder {
  id: string;
  order_number: string;
  status: string;
  priority: "normal" | "urgent";
  patient_ref: string | null;
  due_at: string | null;
  revision_count: number;
  assigned_to: string | null;
  client_org: { id: string; name: string } | { id: string; name: string }[] | null;
  items: { service_code: string }[] | null;
}

interface Designer {
  user_id: string;
  display_name: string | null;
}

interface DesignQueueBoardProps {
  orders: QueueOrder[];
  designers: Designer[];
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function DesignQueueBoard({ orders, designers }: DesignQueueBoardProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = useClientNow();

  const designerName = (userId: string | null) => {
    if (!userId) return null;
    const match = designers.find((d) => d.user_id === userId);
    return match?.display_name ?? "Asignada";
  };

  async function assign(orderId: string, userId: string) {
    setBusyId(orderId);
    try {
      await changeDesignOrderStatus(orderId, "assigned", { assignedTo: userId });
      toast.success("Caso asignado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {DESIGN_KANBAN_COLUMNS.map((column) => {
        const columnOrders = orders.filter((o) => o.status === column.id);

        return (
          <div key={column.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", column.color)} aria-hidden="true" />
              <h2 className="text-sm font-medium text-slate-700">{column.title}</h2>
              <span className="text-xs text-slate-400">{columnOrders.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {columnOrders.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                  Sin casos
                </p>
              )}

              {columnOrders.map((order) => {
                const client = one(order.client_org);
                const overdue =
                  now !== null && order.due_at !== null
                  && new Date(order.due_at).getTime() < now;

                return (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/dashboard/design/${order.id}`}
                          className="text-sm font-medium text-[#044c64] hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        {order.priority === "urgent" && (
                          <Badge
                            variant="outline"
                            className="border-orange-200 bg-orange-50 text-orange-700"
                          >
                            Urgente
                          </Badge>
                        )}
                      </div>

                      <p className="truncate text-xs text-slate-600">
                        {(order.items ?? [])
                          .map((i) => getDesignServiceLabel(i.service_code))
                          .join(" · ") || "Sin servicios"}
                      </p>

                      <p className="truncate text-xs text-slate-400">
                        {client?.name ?? "—"}
                        {order.patient_ref ? ` · ${order.patient_ref}` : ""}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {order.due_at && (
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              overdue ? "font-medium text-red-600" : "text-slate-400",
                            )}
                          >
                            {overdue ? (
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Clock className="h-3 w-3" aria-hidden="true" />
                            )}
                            {new Date(order.due_at).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        )}

                        {order.revision_count > 0 && (
                          <span className="text-slate-400">
                            {order.revision_count} rev.
                          </span>
                        )}

                        {order.assigned_to && (
                          <span className="truncate text-slate-500">
                            {designerName(order.assigned_to)}
                          </span>
                        )}
                      </div>

                      {/* Asignar: solo tiene sentido en la columna por asignar. */}
                      {column.id === "submitted" && designers.length > 0 && (
                        <div className="pt-1">
                          {busyId === order.id ? (
                            <Button variant="outline" size="sm" className="w-full" disabled>
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                              Asignando…
                            </Button>
                          ) : (
                            <Select onValueChange={(userId) => assign(order.id, userId)}>
                              <SelectTrigger className="h-8 text-xs">
                                <span className="flex items-center gap-1.5">
                                  <UserPlus className="h-3 w-3" aria-hidden="true" />
                                  <SelectValue placeholder="Asignar a…" />
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {designers.map((d) => (
                                  <SelectItem key={d.user_id} value={d.user_id}>
                                    {d.display_name ?? "Sin nombre"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
