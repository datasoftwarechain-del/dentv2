"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Building2, User } from "lucide-react";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";

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
  items?: { work_type: string | null }[];
  created_at: string;
  patient: Patient | null;
  dentist_org: Organization | null;
  lab_org: Organization | null;
}

interface OrdersListProps {
  orders: Order[];
  isDentist: boolean;
  organizationId: string;
  patients?: Patient[];
  labs?: Organization[];
}

const statusLabels = ORDER_STATUS_LABELS;
const statusColors = ORDER_STATUS_BADGE_CLASSES;

const workTypes = [
  { value: "corona_metal_ceramica", label: "Corona Metal-Cerámica" },
  { value: "corona_zirconia", label: "Corona Zirconia" },
  { value: "corona_emax", label: "Corona Emax" },
  { value: "puente_fijo", label: "Puente Fijo" },
  { value: "protesis_removible", label: "Prótesis Removible" },
  { value: "protesis_total", label: "Prótesis Total" },
  { value: "implante_corona", label: "Corona sobre Implante" },
  { value: "carilla", label: "Carilla" },
  { value: "incrustacion", label: "Incrustación" },
  { value: "ferula", label: "Férula" },
  { value: "retenedor", label: "Retenedor" },
  { value: "reparacion", label: "Reparación" },
  { value: "otro", label: "Otro" },
];

export function OrdersList({
  orders,
  isDentist,
  organizationId,
  patients = [],
  labs = [],
}: OrdersListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOrders = orders.filter((order) => {
    const patientFirst = order.patient?.first_name?.toLowerCase() ?? "";
    const patientLast = order.patient?.last_name?.toLowerCase() ?? "";
    const matchesSearch =
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      patientFirst.includes(search.toLowerCase()) ||
      patientLast.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleStatusChange(orderId: string, newStatus: string) {
    const supabase = createClient();
    await supabase
      .from("lab_orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    router.refresh();
  }

  return (
    <Card className="border-0 shadow-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Lista de Pedidos
            </CardTitle>
            <CardDescription>
              {isDentist
                ? "Gestión de pedidos enviados a laboratorios"
                : "Gestión de pedidos recibidos de clínicas"}
            </CardDescription>
          </div>
          {isDentist && (
            <CreateOrderDialog
              organizationId={organizationId}
              patients={patients}
              labs={labs}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 border-b border-border/50 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por # Orden, Paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-background/50 focus:bg-background transition-all"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-background/50 focus:bg-background transition-all">
              <SelectValue placeholder="Filtrar por Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="received">Recibido</SelectItem>
              <SelectItem value="missing_info">Falta Info</SelectItem>
              <SelectItem value="in_production">En Producción</SelectItem>
              <SelectItem value="quality_check">Control Calidad</SelectItem>
              <SelectItem value="ready">Listo</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-primary">Pedido</TableHead>
                  <TableHead className="font-semibold text-primary">Paciente</TableHead>
                  <TableHead className="font-semibold text-primary">{isDentist ? "Laboratorio" : "Clínica"}</TableHead>
                  {/* Keep work type column if data available, else might need adjustment */}
                  <TableHead className="font-semibold text-primary">Trabajo</TableHead>
                  <TableHead className="font-semibold text-primary">Estado</TableHead>
                  <TableHead className="font-semibold text-primary">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => {
                      // TODO: Navigate to details
                      // router.push(/dashboard/orders/${order.id});
                    }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{order.order_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.patient ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{order.patient.first_name} {order.patient.last_name}</span>
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {isDentist
                            ? order.lab_org?.name || "Sin asignar"
                            : order.dentist_org?.name || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* Note: work_type usually 1 per order item in new schema, but basic table assumes 1-1 or main type. keeping logic for now */}
                      {workTypes.find((t) => t.value === order.items?.[0]?.work_type)?.label ||
                        order.items?.[0]?.work_type || <span className="text-muted-foreground italic">Ver detalle</span>}
                    </TableCell>
                    <TableCell>
                      {!isDentist ? (
                        <Select
                          value={order.status}
                          onValueChange={(value) =>
                            handleStatusChange(order.id, value)
                          }
                        >
                          <SelectTrigger className={`h-8 w-36 border-0 ${statusColors[order.status] || "bg-muted"}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="missing_info">Falta Info</SelectItem>
                            <SelectItem value="received">Recibido</SelectItem>
                            <SelectItem value="in_production">En Producción</SelectItem>
                            <SelectItem value="quality_check">Control Calidad</SelectItem>
                            <SelectItem value="ready">Listo</SelectItem>
                            <SelectItem value="delivered">Entregado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={`font-medium border ${statusColors[order.status] || "bg-muted"}`}
                        >
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("es-ES", {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-16 text-center bg-muted/5">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted shadow-sm mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No hay pedidos</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
              {isDentist
                ? "Crea tu primer pedido para el laboratorio y comienza a gestionar tus trabajos."
                : "Aún no has recibido pedidos de clínicas."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
