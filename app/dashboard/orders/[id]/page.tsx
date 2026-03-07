import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    Clock,
    FileText,
    Building2,
    User,
    Calendar,
    Printer,
    MessageSquare,
    AlertCircle,
    Download,
    File,
    Pencil,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { formatSimpleDate, formatDateTime } from "@/lib/date-utils";
import { EditDueDateButton } from "@/components/orders/edit-due-date-button";
import { CaseFilesSection } from "@/components/orders/case-files-section";
import { formatWorkType } from "@/lib/work-types";

export default async function OrderDetailsPage({
    params,
}: {
    params: { id: string };
}) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    // Get user's organizations (handle multiple orgs like layout does)
    const { data: memberships } = await supabase
        .from("org_members")
        .select("organization:org_id(id, name, type, is_system_account)")
        .eq("user_id", user.id);

    // Filter for system accounts only and get the first one
    const orgs = (memberships || [])
        .map((m: any) => {
            const orgData = m.organization;
            return Array.isArray(orgData) ? orgData[0] : orgData;
        })
        .filter((o: any) => o && o.is_system_account !== false);

    const org = orgs[0] || null;
    if (!org) redirect("/dashboard");

    const isDentist = org.type === "dentist";

    // Fetch order details with related data
    const { data: order } = await supabase
        .from("lab_orders")
        .select(`
      *,
      patient:patients(first_name, last_name, id),
      dentist_org:organizations!lab_orders_dentist_org_id_fkey(name),
      lab_org:organizations!lab_orders_lab_org_id_fkey(name),
      items:lab_order_items(*, catalog_item:price_catalog(name))
    `)
        .eq("id", id)
        .single();


    if (!order) notFound();

    // Security check: must belong to the org
    if (isDentist && order.dentist_org_id !== org.id) notFound();
    if (!isDentist && order.lab_org_id !== org.id) notFound();

    const statusLabels = ORDER_STATUS_LABELS;
    const statusColors = ORDER_STATUS_BADGE_CLASSES;

    return (
        <div className="flex flex-col min-h-screen bg-background/50">
            <DashboardHeader
                title={`Orden ${order.order_number}`}
                user={{
                    email: user.email || "",
                    firstName: user.user_metadata?.first_name,
                    lastName: user.user_metadata?.last_name,
                }}
            />

            <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Link href="/dashboard/orders">
                        <Button variant="ghost" size="sm" className="hover:bg-muted font-bold text-xs uppercase tracking-wider">
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Ver Todas las Órdenes
                        </Button>
                    </Link>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-9 px-4 font-bold text-xs">
                            <Printer className="mr-2 h-4 w-4" /> Imprimir
                        </Button>
                        <Link href={`/dashboard/orders/${order.id}/edit`}>
                            <Button variant="outline" size="sm" className="h-9 px-4 font-bold text-xs border-[#09919b] text-[#09919b] hover:bg-[#09919b]/10">
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                            </Button>
                        </Link>
                        <Button className="h-9 px-4 font-bold text-xs bg-primary hover:bg-primary/90">
                            <MessageSquare className="mr-2 h-4 w-4" /> Chat Lab
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden">
                            <div className="h-2 bg-gradient-to-r from-primary to-accent" />
                            <CardHeader className="flex flex-row items-center justify-between pb-6">
                                <div>
                                    <CardTitle className="text-2xl font-bold">{order.order_number}</CardTitle>
                                    <CardDescription className="text-xs font-medium mt-1">
                                        Creada el {formatSimpleDate(order.created_at)}
                                    </CardDescription>
                                </div>
                                <Badge className={cn("px-4 py-1 text-xs font-bold uppercase", statusColors[order.status])}>
                                    {statusLabels[order.status] || order.status}
                                </Badge>
                            </CardHeader>
                            <CardContent className="grid gap-8 py-6 border-t border-border/40">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                            <User className="h-3 w-3" /> Paciente
                                        </p>
                                        <p className="font-bold text-sm">
                                            {order.patient ? (
                                                <Link href={`/dashboard/patients/${order.patient.id}`} className="hover:text-primary transition-colors">
                                                    {order.patient.first_name} {order.patient.last_name}
                                                </Link>
                                            ) : "Sin paciente"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                            <Building2 className="h-3 w-3" /> Laboratorio
                                        </p>
                                        <p className="font-bold text-sm">{(order.lab_org as any)?.name || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3" /> Fecha Entrega
                                        </p>
                                        <EditDueDateButton
                                            orderId={order.id}
                                            currentDueDate={order.due_date}
                                        />
                                    </div>
                                </div>

                                {/* Items Section */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ítems de la Orden</h3>
                                    {order.items && order.items.length > 0 ? (
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 overflow-hidden text-sm">
                                            <table className="w-full">
                                                <thead className="bg-muted/50 border-b border-border/40">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-bold text-[11px] uppercase text-muted-foreground">Trabajo</th>
                                                        <th className="px-4 py-3 text-left font-bold text-[11px] uppercase text-muted-foreground">Piezas</th>
                                                        <th className="px-4 py-3 text-left font-bold text-[11px] uppercase text-muted-foreground">Color</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40">
                                                    {order.items.map((item: any) => {
                                                        const catalogName = Array.isArray(item.catalog_item)
                                                            ? item.catalog_item[0]?.name
                                                            : item.catalog_item?.name;
                                                        const workLabel = catalogName || formatWorkType(item.work_type) || "—";
                                                        const extras: { name: string; price?: number; qty: number }[] =
                                                            Array.isArray(item.selected_extras) ? item.selected_extras : [];
                                                        return (
                                                            <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                                                <td className="px-4 py-4 font-bold">
                                                                    {workLabel}
                                                                    {extras.length > 0 && (
                                                                        <div className="mt-1 space-y-0.5">
                                                                            {extras.map((e, i) => (
                                                                                <p key={i} className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                                                                                    <span>+ {e.name}{e.qty > 1 ? ` ×${e.qty}` : ""}</span>
                                                                                    {e.price != null && e.price > 0 && (
                                                                                        <span className="text-[#09919b] font-medium">${e.price * e.qty}</span>
                                                                                    )}
                                                                                </p>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    {Array.isArray(item.tooth_positions)
                                                                        ? item.tooth_positions.join(", ") || "Varias"
                                                                        : item.tooth_positions || "Varias"}
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <Badge variant="secondary" className="font-bold">{item.shade || "N/A"}</Badge>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/10 text-center text-sm text-muted-foreground">
                                            No hay detalles de ítems registrados para esta orden.
                                        </div>
                                    )}
                                </div>

                                {/* Case Files Section - Client Component */}
                                <CaseFilesSection orderId={order.id} />

                                {/* Notes */}
                                {(order.notes || order.internal_notes) && (
                                    <div className="space-y-4 pt-4 border-t border-border/40">
                                        {order.notes && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-primary italic uppercase tracking-widest px-2 border-l-2 border-primary">Notas del Dentista</p>
                                                <p className="text-sm bg-muted/30 p-4 rounded-2xl border border-border/20 shadow-inner">{order.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar / Sidebar Timeline */}
                    <div className="space-y-6">
                        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Estado del Trabajo</CardTitle>
                                <CardDescription className="text-xs font-medium">Cronología de producción</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-0">
                                    {/* Step 1: Orden Recibida */}
                                    <div className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="h-9 w-9 rounded-full border-4 border-background bg-primary shadow-md flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                                                <Clock className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <div className="w-[2px] bg-muted/60 grow my-1 rounded-full" />
                                        </div>
                                        <div className="space-y-0.5 pb-5 pt-1">
                                            <p className="text-xs font-bold">Orden Recibida</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{formatDateTime(order.created_at)}</p>
                                        </div>
                                    </div>

                                    {/* Step 2: En Producción (pending) */}
                                    <div className="flex gap-3 opacity-40">
                                        <div className="flex flex-col items-center">
                                            <div className="h-9 w-9 rounded-full border-4 border-background bg-muted shadow-sm flex items-center justify-center shrink-0">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            </div>
                                        </div>
                                        <div className="space-y-0.5 pt-1">
                                            <p className="text-xs font-bold">En Producción</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">Pendiente</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border/40">
                                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30">
                                        <div className="flex gap-2">
                                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-400">
                                                La fecha estimada de entrega puede variar según la complejidad del trabajo.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
