import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Building2, FileText, Calendar, Phone, Mail, MapPin, CreditCard, Hash, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { StatusBadge } from "@/components/orders/status-badge";
import { ClientEditDialog } from "@/components/clients/client-edit-dialog";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id: clientOrgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Verify caller is a lab member
  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type, is_system_account)")
    .eq("user_id", user.id);

  const orgs = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any) => o && o.is_system_account !== false);

  const org = orgs[0] || null;
  if (!org || org.type !== "lab") redirect("/dashboard");

  // Fetch client org
  const { data: client } = await supabase
    .from("organizations")
    .select("id, name, type, phone, email, address, city, tax_id, settings, created_at")
    .eq("id", clientOrgId)
    .single();

  if (!client) notFound();

  // Verify this org has orders with the lab (security check)
  const { data: orderCheck } = await supabase
    .from("lab_orders")
    .select("id")
    .eq("lab_org_id", org.id)
    .eq("dentist_org_id", clientOrgId)
    .limit(1)
    .maybeSingle();

  if (!orderCheck) notFound();

  // Fetch orders for this client
  const { data: orders } = await supabase
    .from("lab_orders")
    .select(`
      id, order_number, status, due_date, created_at,
      patient:patients(first_name, last_name),
      items:lab_order_items(work_type)
    `)
    .eq("lab_org_id", org.id)
    .eq("dentist_org_id", clientOrgId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, status, created_at")
    .eq("lab_org_id", org.id)
    .eq("dentist_org_id", clientOrgId);

  const totalInvoiced = invoices?.reduce((s, i) => s + Number(i.total), 0) || 0;
  const totalPending = invoices?.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.total), 0) || 0;
  const notes = (client.settings as any)?.notes || null;

  const contactFields = [
    { icon: Phone, label: "Teléfono", value: client.phone },
    { icon: Mail, label: "Email", value: client.email },
    { icon: MapPin, label: "Dirección", value: client.address },
    { icon: Building2, label: "Ciudad", value: client.city },
    { icon: CreditCard, label: "RUT / ID Fiscal", value: client.tax_id },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background/50">
      <DashboardHeader
        title={client.name}
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Back + actions */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="sm" className="font-bold text-xs uppercase tracking-wider hover:bg-muted">
              <ChevronLeft className="mr-1 h-4 w-4" /> Todas las Clínicas
            </Button>
          </Link>
          <ClientEditDialog
            clientId={clientOrgId}
            initialData={{
              phone: client.phone || "",
              email: client.email || "",
              address: client.address || "",
              city: client.city || "",
              tax_id: client.tax_id || "",
              notes: notes || "",
            }}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact info card */}
            <Card className="border border-border/50 shadow-sm bg-background/50 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">{client.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-medium">
                      Cliente desde {formatSimpleDate(client.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider border-primary/30 text-primary">
                  Clínica
                </Badge>
              </CardHeader>
              <CardContent className="border-t border-border/40 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {contactFields.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                      <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border/40">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                        {value ? (
                          <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/50 italic mt-0.5">Sin información</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {notes && (
                  <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20">
                    <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border/40">
                      <MessageSquare className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Notas</p>
                      <p className="text-sm font-medium mt-0.5 text-amber-900 dark:text-amber-300">{notes}</p>
                    </div>
                  </div>
                )}
                {!contactFields.some(f => f.value) && !notes && (
                  <div className="mt-2 text-center py-4 text-sm text-muted-foreground">
                    <p>No hay información de contacto aún.</p>
                    <p className="text-xs mt-1">Usa el botón "Editar información" para agregarla.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent orders */}
            <Card className="border border-border/50 shadow-sm bg-background/50">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Pedidos ({orders?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs">Historial de órdenes de esta clínica</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {orders && orders.length > 0 ? (
                  <div className="space-y-2">
                    {orders.map((order: any) => {
                      const patient = Array.isArray(order.patient) ? order.patient[0] : order.patient;
                      const items = order.items || [];
                      const workTypes = [...new Set(items.map((i: any) => i.work_type?.replace(/_/g, " ")))].slice(0, 2).join(", ");
                      return (
                        <Link key={order.id} href={`/dashboard/orders/${order.id}`} className="group">
                          <div className="flex items-center justify-between rounded-xl border border-border/40 p-3 hover:bg-muted/30 hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-bold text-sm group-hover:text-primary transition-colors">
                                  {order.order_number}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {patient ? `${patient.first_name} ${patient.last_name}` : "Sin paciente"}
                                  {workTypes && ` · ${workTypes}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              <div>
                                <StatusBadge status={order.status} className="text-[9px]" />
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                                  <Calendar className="h-3 w-3" />
                                  {formatSimpleDate(order.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No hay pedidos registrados
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Stats */}
            <Card className="border border-border/50 shadow-sm bg-background/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Total pedidos", value: orders?.length || 0, format: "number" },
                  { label: "Total facturado", value: totalInvoiced, format: "money" },
                  { label: "Saldo pendiente", value: totalPending, format: "money", highlight: totalPending > 0 },
                ].map(({ label, value, format, highlight }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                    <span className={cn("font-bold text-sm", highlight ? "text-amber-600" : "")}>
                      {format === "money" ? `$${formatNumber(value as number)}` : value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Last order date */}
            {orders && orders.length > 0 && (
              <Card className="border border-border/50 shadow-sm bg-background/50">
                <CardContent className="pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Último Pedido</p>
                  <p className="text-sm font-bold">{formatSimpleDate(orders[0].created_at)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{orders[0].order_number}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick actions */}
            <Card className="border border-border/50 shadow-sm bg-background/50">
              <CardContent className="pt-5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Acciones</p>
                <Link href={`/dashboard/billing/accounts/${clientOrgId}`} className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start font-bold text-xs">
                    <FileText className="mr-2 h-4 w-4" /> Ver estado de cuenta
                  </Button>
                </Link>
                <Link href={`/dashboard/orders?client=${clientOrgId}`} className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start font-bold text-xs">
                    <Hash className="mr-2 h-4 w-4" /> Ver todos los pedidos
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
