import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getUserOrg } from "@/lib/get-user-org";
import { canViewPrices } from "@/lib/permissions";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    User,
    Phone,
    Mail,
    MapPin,
    Calendar,
    ChevronLeft,
    Clock,
    FileText,
    Plus
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PatientActions, AppointmentActions, OrderActions } from "@/components/patients/patient-actions";
import { formatSimpleDate, formatFullDate, formatTime } from "@/lib/date-utils";

export default async function PatientDetailsPage({
    params,
}: {
    params: { id: string };
}) {
    const { id } = await params;
    const { user, org, permissions } = await getUserOrg();
    const supabase = await createClient();

    if (org.type !== "dentist") redirect("/dashboard");

    const showPrices = canViewPrices(permissions);

    // Fetch patient details
    const { data: patient } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .eq("dentist_org_id", org.id)
        .single();

    if (!patient) notFound();

    // Fetch appointments
    const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", id)
        .order("scheduled_at", { ascending: false });

    // Fetch lab orders
    const { data: orders } = await supabase
        .from("lab_orders")
        .select("*, lab_org:organizations(name)")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });

    // Fetch labs for order creation (connected labs only)
    type LabOrg = { id: string; name: string };
    type LabRelation = { lab_org: LabOrg | LabOrg[] | null };
    const { data: labRelationsRaw } = await supabase
      .from("lab_dentist_relations")
      .select("lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)")
      .eq("dentist_org_id", org.id)
      .eq("status", "active");
    const labRelations = (labRelationsRaw || []) as LabRelation[];
    const labs = labRelations
      .flatMap((rel) => {
        const lab = rel.lab_org;
        if (!lab) return [];
        return Array.isArray(lab) ? lab : [lab];
      })
      .filter((lab): lab is LabOrg => Boolean(lab?.id && lab?.name));
    labs.sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex flex-col min-h-screen bg-background/50">
            <DashboardHeader
                title={`${patient.first_name} ${patient.last_name}`}
                user={{
                    email: user.email || "",
                    firstName: user.user_metadata?.first_name,
                    lastName: user.user_metadata?.last_name,
                }}
            />

            <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
                {/* Back button */}
                <Link href="/dashboard/patients">
                    <Button variant="ghost" size="sm" className="mb-4 hover:bg-muted font-bold text-xs">
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Volver a Pacientes
                    </Button>
                </Link>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Patient Info Card */}
                    <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm lg:col-span-1">
                        <CardHeader className="flex flex-row items-center gap-4 border-b border-border/40 pb-6">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                {patient.first_name[0]}{patient.last_name[0]}
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold">{patient.first_name} {patient.last_name}</CardTitle>
                                <CardDescription className="text-xs font-medium mt-1">
                                    Registrado el {formatSimpleDate(patient.created_at)}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Email</p>
                                    <p className="font-medium">{patient.email || "No registrado"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Teléfono</p>
                                    <p className="font-medium">{patient.phone || "No registrado"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Fecha de Nacimiento</p>
                                    <p className="font-medium">{patient.date_of_birth ? formatSimpleDate(patient.date_of_birth) : "No registrado"}</p>
                                </div>
                            </div>

                            <PatientActions patient={patient} organizationId={org.id} labs={labs || []} />
                        </CardContent>
                    </Card>

                    {/* Activity Tabs Section (Simplified for now) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Appointments */}
                        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold">Citas Médicas</CardTitle>
                                    <CardDescription className="text-xs">Historial de consultas del paciente</CardDescription>
                                </div>
                                <AppointmentActions patient={patient} organizationId={org.id} />
                            </CardHeader>
                            <CardContent>
                                {appointments && appointments.length > 0 ? (
                                    <div className="space-y-3">
                                        {appointments.map((apt) => (
                                            <div key={apt.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/30 hover:bg-background/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{formatFullDate(apt.scheduled_at)}</p>
                                                        <p className="text-[10px] font-medium text-muted-foreground">{formatTime(apt.scheduled_at)} • {apt.duration_minutes} min</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider",
                                                    apt.status === 'completed' ? "bg-secondary/[0.08] text-secondary border-secondary/20" : "bg-primary/[0.08] text-primary border-primary/20"
                                                )}>
                                                    {apt.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        No hay citas registradas.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Lab Orders */}
                        <Card className="border border-border/50 shadow-premium bg-background/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold">Órdenes de Laboratorio</CardTitle>
                                    <CardDescription className="text-xs">Trabajos dentales enviados</CardDescription>
                                </div>
                                <OrderActions patient={patient} organizationId={org.id} labs={labs || []} showPrices={showPrices} />
                            </CardHeader>
                            <CardContent>
                                {orders && orders.length > 0 ? (
                                    <div className="space-y-3">
                                        {orders.map((order) => (
                                            <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/30 hover:bg-background/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{order.order_number}</p>
                                                        <p className="text-[10px] font-medium text-muted-foreground">Lab: {(order.lab_org as any)?.name || "N/A"}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border-accent/20">
                                                    {order.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        No hay órdenes registradas.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
