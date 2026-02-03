"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Building2 } from "lucide-react";
import { ORDER_STATUS_KANBAN_COLUMNS } from "@/lib/order-status";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Organization {
  id: string;
  name: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  items?: {
    work_type: string | null;
    tooth_positions: string[] | null;
    shade: string | null;
  }[];
  notes: string | null;
  due_date: string | null;
  created_at: string;
  patient: Patient | null;
  dentist_org: Organization | null;
}

interface KanbanBoardProps {
  orders: Order[];
}

const columns = ORDER_STATUS_KANBAN_COLUMNS;

const workTypeLabels: Record<string, string> = {
  corona_metal_ceramica: "Corona Metal-Ceramica",
  corona_zirconia: "Corona Zirconia",
  corona_emax: "Corona Emax",
  puente_fijo: "Puente Fijo",
  protesis_removible: "Protesis Removible",
  protesis_total: "Protesis Total",
  implante_corona: "Corona sobre Implante",
  carilla: "Carilla",
  incrustacion: "Incrustacion",
  ferula: "Ferula",
  retenedor: "Retenedor",
  reparacion: "Reparacion",
  otro: "Otro",
};

export function KanbanBoard({ orders }: KanbanBoardProps) {
  const router = useRouter();
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);

  async function handleDrop(orderId: string, newStatus: string) {
    const supabase = createClient();
    await supabase
      .from("lab_orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    router.refresh();
  }

  function handleDragStart(orderId: string) {
    setDraggedOrder(orderId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDropOnColumn(e: React.DragEvent, status: string) {
    e.preventDefault();
    if (draggedOrder) {
      handleDrop(draggedOrder, status);
      setDraggedOrder(null);
    }
  }

  function getOrdersByStatus(status: string) {
    return orders.filter((order) => order.status === status);
  }

  function getDaysUntilDue(dueDate: string | null) {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  return (
    <div className="flex min-w-max gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="w-80 shrink-0"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropOnColumn(e, column.id)}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${column.color}`} />
            <h3 className="font-semibold">{column.title}</h3>
            <Badge variant="secondary" className="ml-auto">
              {getOrdersByStatus(column.id).length}
            </Badge>
          </div>

          <div className="space-y-3">
            {getOrdersByStatus(column.id).map((order) => {
              const daysUntilDue = getDaysUntilDue(order.due_date);
              const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
              const isUrgent = daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0;
              const firstItem = order.items?.[0];
              const workType = firstItem?.work_type || "";
              const toothPositions = firstItem?.tooth_positions || null;
              const shade = firstItem?.shade || null;

              return (
                <Card
                  key={order.id}
                  draggable
                  onDragStart={() => handleDragStart(order.id)}
                  className="cursor-grab bg-card transition-shadow hover:shadow-md active:cursor-grabbing"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium">
                        {order.order_number}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {workTypeLabels[workType] || workType || "Sin trabajo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-2 text-sm">
                      {order.patient && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>
                            {order.patient.first_name} {order.patient.last_name}
                          </span>
                        </div>
                      )}
                      {order.dentist_org && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{order.dentist_org.name}</span>
                        </div>
                      )}
                      {toothPositions && toothPositions.length > 0 && (
                        <div className="text-muted-foreground">
                          Piezas: {toothPositions.join(", ")}
                        </div>
                      )}
                      {shade && (
                        <div className="text-muted-foreground">
                          Color: {shade}
                        </div>
                      )}
                      {order.due_date && (
                        <div
                          className={`flex items-center gap-2 ${
                            isOverdue
                              ? "text-destructive"
                              : isUrgent
                              ? "text-yellow-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          <span>
                            {isOverdue
                              ? `Vencido hace ${Math.abs(daysUntilDue!)} dias`
                              : daysUntilDue === 0
                              ? "Entrega hoy"
                              : `${daysUntilDue} dias restantes`}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {getOrdersByStatus(column.id).length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Arrastra pedidos aqui
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
