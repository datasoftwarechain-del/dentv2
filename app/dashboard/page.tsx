import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Calendar, DollarSign, Clock, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get organization
  const { data: membership } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type)")
    .eq("user_id", user.id)
    .single();

  const org = membership?.organization as { id: string; name: string; type: string } | null;
  if (!org) return null;

  const isDentist = org.type === "dentist";

  // Fetch stats
  const { count: ordersCount } = await supabase
    .from("lab_orders")
    .select("*", { count: "exact", head: true })
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id);

  const { count: pendingOrders } = await supabase
    .from("lab_orders")
    .select("*", { count: "exact", head: true })
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .in("status", ["pending", "in_progress"]);

  // For dentists, get patient count
  let patientsCount = 0;
  if (isDentist) {
    const { count } = await supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .eq("dentist_org_id", org.id);
    patientsCount = count || 0;
  }

  // Get recent orders
  const { data: recentOrders } = await supabase
    .from("lab_orders")
    .select(`
      id, 
      order_number, 
      status, 
      created_at,
      patient:patients(first_name, last_name)
    `)
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = isDentist
    ? [
      { label: "Total Pacientes", value: patientsCount, icon: Users },
      { label: "Pedidos Totales", value: ordersCount || 0, icon: FileText },
      { label: "Pedidos Pendientes", value: pendingOrders || 0, icon: Clock },
      { label: "Este Mes", value: "$2,450", icon: DollarSign },
    ]
    : [
      { label: "Pedidos Totales", value: ordersCount || 0, icon: FileText },
      { label: "En Produccion", value: pendingOrders || 0, icon: Clock },
      { label: "Clinicas Activas", value: 12, icon: Users },
      { label: "Ingresos del Mes", value: "$8,750", icon: TrendingUp },
    ];

  const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En Progreso",
    completed: "Completado",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    delivered: "bg-accent/10 text-accent",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Dashboard"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recientes</CardTitle>
            <CardDescription>
              Ultimos pedidos {isDentist ? "enviados" : "recibidos"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => {
                  const patient = order.patient as { first_name: string; last_name: string } | null;
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {patient ? `${patient.first_name} ${patient.last_name}` : "Sin paciente"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${statusColors[order.status] || "bg-muted"
                            }`}
                        >
                          {statusLabels[order.status] || order.status}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No hay pedidos recientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
