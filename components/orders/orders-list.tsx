"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Search, FileText, Loader2 } from "lucide-react";

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
  work_type: string;
  tooth_numbers: string | null;
  shade: string | null;
  notes: string | null;
  due_date: string | null;
  total_price: number;
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

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En Progreso",
  completed: "Completado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  in_progress: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  completed: "bg-green-100 text-green-800 hover:bg-green-100",
  delivered: "bg-accent/10 text-accent hover:bg-accent/10",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
};

const workTypes = [
  { value: "crown", label: "Corona" },
  { value: "bridge", label: "Puente" },
  { value: "implant", label: "Implante" },
  { value: "denture", label: "Protesis" },
  { value: "veneer", label: "Carilla" },
  { value: "inlay", label: "Inlay/Onlay" },
  { value: "other", label: "Otro" },
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientId: "",
    labId: "",
    workType: "",
    toothNumbers: "",
    shade: "",
    notes: "",
    dueDate: "",
  });

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      order.patient?.first_name.toLowerCase().includes(search.toLowerCase()) ||
      order.patient?.last_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    
    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabase.from("lab_orders").insert({
      order_number: orderNumber,
      dentist_org_id: organizationId,
      lab_org_id: formData.labId || null,
      patient_id: formData.patientId,
      work_type: formData.workType,
      tooth_numbers: formData.toothNumbers || null,
      shade: formData.shade || null,
      notes: formData.notes || null,
      due_date: formData.dueDate || null,
      status: "pending",
      total_price: 0,
    });

    if (!error) {
      setDialogOpen(false);
      setFormData({
        patientId: "",
        labId: "",
        workType: "",
        toothNumbers: "",
        shade: "",
        notes: "",
        dueDate: "",
      });
      router.refresh();
    }

    setLoading(false);
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    const supabase = createClient();
    await supabase
      .from("lab_orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>
              {isDentist
                ? "Pedidos enviados a laboratorios"
                : "Pedidos recibidos de clinicas"}
            </CardDescription>
          </div>
          {isDentist && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Pedido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Crear Pedido</DialogTitle>
                  <DialogDescription>
                    Envia un nuevo pedido al laboratorio
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateOrder} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Paciente</Label>
                    <Select
                      value={formData.patientId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, patientId: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.first_name} {patient.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="labId">Laboratorio</Label>
                    <Select
                      value={formData.labId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, labId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un laboratorio" />
                      </SelectTrigger>
                      <SelectContent>
                        {labs.map((lab) => (
                          <SelectItem key={lab.id} value={lab.id}>
                            {lab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workType">Tipo de Trabajo</Label>
                    <Select
                      value={formData.workType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, workType: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {workTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="toothNumbers">Piezas Dentales</Label>
                      <Input
                        id="toothNumbers"
                        placeholder="Ej: 11, 12, 21"
                        value={formData.toothNumbers}
                        onChange={(e) =>
                          setFormData({ ...formData, toothNumbers: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shade">Color/Tono</Label>
                      <Input
                        id="shade"
                        placeholder="Ej: A2, B1"
                        value={formData.shade}
                        onChange={(e) =>
                          setFormData({ ...formData, shade: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Fecha de Entrega</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Instrucciones adicionales..."
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Crear Pedido
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pedidos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>{isDentist ? "Laboratorio" : "Clinica"}</TableHead>
                  <TableHead>Trabajo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      {order.patient
                        ? `${order.patient.first_name} ${order.patient.last_name}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {isDentist
                        ? order.lab_org?.name || "Sin asignar"
                        : order.dentist_org?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {workTypes.find((t) => t.value === order.work_type)?.label ||
                        order.work_type}
                    </TableCell>
                    <TableCell>
                      {!isDentist ? (
                        <Select
                          value={order.status}
                          onValueChange={(value) =>
                            handleStatusChange(order.id, value)
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="in_progress">En Progreso</SelectItem>
                            <SelectItem value="completed">Completado</SelectItem>
                            <SelectItem value="delivered">Entregado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={statusColors[order.status] || ""}
                        >
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No hay pedidos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDentist
                ? "Crea tu primer pedido para el laboratorio"
                : "Aun no has recibido pedidos"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
