import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_ACTIVE,
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/lib/order-status";
import {
  FileText,
  Users,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  PlusCircle,
  ArrowRight,
  ClipboardList,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { QuickActions } from "@/components/dashboard/quick-actions";

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

  const orgData = membership?.organization as
    | { id: string; name: string; type: string }
    | { id: string; name: string; type: string }[]
    | null
    | undefined;
  const org = Array.isArray(orgData) ? orgData[0] : orgData ?? null;
  if (!org) return null;

  const isDentist = org.type === "dentist";

  // Fetch stats
  const { count: ordersCount } = await supabase
    .from("lab_orders")
    .select("*", { count: "exact", head: true })
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id);

  const { count: activeOrders } = await supabase
    .from("lab_orders")
    .select("*", { count: "exact", head: true })
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .in("status", ORDER_STATUS_ACTIVE as unknown as string[]);

  const { count: inProductionOrders } = await supabase
    .from("lab_orders")
    .select("*", { count: "exact", head: true })
    .eq(isDentist ? "dentist_org_id" : "lab_org_id", org.id)
    .in("status", ["in_production"]);

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
      { label: "Total Pacientes", value: patientsCount, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
      { label: "Pedidos Totales", value: ordersCount || 0, icon: FileText, color: "text-accent", bg: "bg-accent/10" },
      { label: "Pendientes", value: activeOrders || 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
      { label: "Facturación Mes", value: "$2,450", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    ]
    : [
      { label: "Pedidos Totales", value: ordersCount || 0, icon: FileText, color: "text-accent", bg: "bg-accent/10" },
      { label: "En Producción", value: inProductionOrders || 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
      { label: "Clínicas Activas", value: 12, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
      { label: "Ingresos Mes", value: "$8,750", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    ];

  const statusLabels = ORDER_STATUS_LABELS;
  const statusColors = ORDER_STATUS_BADGE_CLASSES;

  // Fetch patients and labs for dialogs
  let patients: { id: string; first_name: string; last_name: string }[] = [];
  let labs: { id: string; name: string }[] = [];

  if (isDentist) {
    const { data: patientsData } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("dentist_org_id", org.id);
    patients = patientsData || [];

    type LabOrg = { id: string; name: string };
    type LabRelation = { lab_org: LabOrg | LabOrg[] | null };
    const { data: labRelationsRaw } = await supabase
      .from("lab_dentist_relations")
      .select("lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)")
      .eq("dentist_org_id", org.id)
      .eq("status", "active");
    const labRelations = (labRelationsRaw || []) as LabRelation[];
    labs = labRelations
      .flatMap((rel) => {
        const lab = rel.lab_org;
        if (!lab) return [];
        return Array.isArray(lab) ? lab : [lab];
      })
      .filter((lab): lab is LabOrg => Boolean(lab?.id && lab?.name));
    labs.sort((a, b) => a.name.localeCompare(b.name));
  }

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

      <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full">
        {/* Quick Actions for Dentists */}
        {isDentist && <QuickActions organizationId={org.id} patients={patients} labs={labs} />}

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="group overflow-hidden border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                  {stat.label}
                </p>
                <div className={cn("p-2 rounded-xl transition-colors duration-300", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl font-bold tracking-tight">{stat.value}</h4>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+12%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 font-medium">Comparado con el mes pasado</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Orders List */}
          <Card className="lg:col-span-2 border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Pedidos Recientes</CardTitle>
                <CardDescription className="text-xs font-medium">
                  Últimos pedidos {isDentist ? "enviados al laboratorio" : "recibidos en el laboratorio"}
                </CardDescription>
              </div>
              <Link href="/dashboard/orders">
                <Button variant="ghost" size="sm" className="text-xs font-bold text-primary hover:bg-primary/10">
                  Ver todos <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders && recentOrders.length > 0 ? (
                <div className="space-y-1">
                  {recentOrders.map((order) => {
                    const patientData = order.patient as
                      | { first_name: string; last_name: string }
                      | { first_name: string; last_name: string }[]
                      | null
                      | undefined;
                    const patient = Array.isArray(patientData) ? patientData[0] : patientData ?? null;
                    return (
                      <Link
                        key={order.id}
                        href={`/dashboard/orders/${order.id}`}
                        className="flex items-center justify-between rounded-2xl p-4 hover:bg-muted/30 transition-all duration-300 group ring-1 ring-transparent hover:ring-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center font-bold text-[10px] text-muted-foreground group-hover:bg-white transition-colors shadow-sm">
                            #{order.order_number.slice(-4)}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{order.order_number}</p>
                            <p className="text-xs font-medium text-muted-foreground">
                              {patient ? `${patient.first_name} ${patient.last_name}` : "Sin paciente"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-[11px] font-bold text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors shadow-sm",
                              statusColors[order.status] || "bg-muted text-muted-foreground"
                            )}
                          >
                            {statusLabels[order.status] || order.status}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No hay pedidos registrados aún.
                  </p>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-bold">Crear primer pedido</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity / Info Card */}
          <Card className="border-none shadow-premium bg-gradient-to-br from-primary to-primary/90 text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="h-32 w-32 rotate-12" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white">Resumen Mensual</CardTitle>
              <CardDescription className="text-primary-foreground/70 font-medium text-xs">Análisis de rendimiento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Meta de Pedidos</span>
                  <span>75%</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent w-[75%] rounded-full shadow-lg shadow-accent/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-white/60 mb-1 uppercase tracking-wider">Eficiencia</p>
                  <p className="text-xl font-bold text-white">94%</p>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-white/60 mb-1 uppercase tracking-wider">Ahorro</p>
                  <p className="text-xl font-bold text-white">$420</p>
                </div>
              </div>

              <Button className="w-full bg-white text-primary hover:bg-white/90 font-bold text-xs h-10 shadow-xl shadow-black/10">
                Ver reporte detallado
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
