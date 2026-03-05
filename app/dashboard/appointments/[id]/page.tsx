import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, FileText, ChevronLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function AppointmentDetailPage(props: PageProps) {
  const params = await Promise.resolve(props.params);
  const appointmentId = params.id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Get user's organization
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
  if (!org || org.type !== "dentist") redirect("/dashboard");

  // Fetch appointment
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email)
    `)
    .eq("id", appointmentId)
    .eq("dentist_org_id", org.id)
    .single();

  if (error || !appointment) {
    notFound();
  }

  const patientData = appointment.patient;
  const patient = Array.isArray(patientData) ? patientData[0] : patientData;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return {
      fullDate: `${dayName} ${day} de ${month} de ${year}`,
      time: `${hours}:${minutes}`,
      date: `${day} ${month} ${year}`,
    };
  };

  const dateTime = formatDateTime(appointment.scheduled_at);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Confirmada", className: "bg-secondary/[0.10] text-secondary border-secondary/25" };
      case "cancelled":
        return { label: "Cancelada", className: "bg-rose-100 text-rose-700 border-rose-300" };
      case "completed":
        return { label: "Completada", className: "bg-blue-100 text-blue-700 border-blue-300" };
      default:
        return { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-300" };
    }
  };

  const statusBadge = getStatusBadge(appointment.status);

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Detalle de Cita"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back button and actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/appointments">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver a citas
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/appointments/${appointmentId}/edit`}>
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Link>
            </Button>
          </div>

          {/* Main appointment card */}
          <Card className="border-2 border-[#b0dde0] shadow-premium overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-[#f0fafb] to-white border-b border-[#d2f2f3]">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-[#044c64] mb-2">
                    Cita Médica
                  </CardTitle>
                  <CardDescription className="text-sm">
                    ID: {appointmentId.slice(0, 8)}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={cn("text-sm font-semibold px-3 py-1", statusBadge.className)}>
                  {statusBadge.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Date and time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#f0fafb] border border-[#d2f2f3]">
                  <div className="p-2 rounded-lg bg-[#e0f4f6]">
                    <Calendar className="h-5 w-5 text-[#09919b]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Fecha
                    </p>
                    <p className="text-sm font-semibold text-[#044c64]">
                      {dateTime.fullDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#f0fafb] border border-[#d2f2f3]">
                  <div className="p-2 rounded-lg bg-[#e0f4f6]">
                    <Clock className="h-5 w-5 text-[#09919b]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Hora
                    </p>
                    <p className="text-sm font-semibold text-[#044c64]">
                      {dateTime.time}
                    </p>
                  </div>
                </div>
              </div>

              {/* Patient info */}
              {patient && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#f0fafb] to-white border border-[#d2f2f3]">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-5 w-5 text-[#09919b]" />
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Paciente
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-[#044c64]">
                      {patient.first_name} {patient.last_name}
                    </p>
                    {patient.phone && (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Teléfono:</span> {patient.phone}
                      </p>
                    )}
                    {patient.email && (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Email:</span> {patient.email}
                      </p>
                    )}
                    <Button variant="outline" size="sm" asChild className="mt-2">
                      <Link href={`/dashboard/patients/${patient.id}`}>
                        Ver perfil del paciente
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Notes */}
              {appointment.notes && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#f0fafb] to-white border border-[#d2f2f3]">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-[#09919b]" />
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Notas
                    </h3>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {appointment.notes}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-[#d2f2f3]">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold">Creada:</span>{" "}
                  {new Date(appointment.created_at).toLocaleString("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                {appointment.updated_at && appointment.updated_at !== appointment.created_at && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-semibold">Última actualización:</span>{" "}
                    {new Date(appointment.updated_at).toLocaleString("es-ES", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" size="lg" className="h-auto py-4" asChild>
              <Link href={`/dashboard/appointments/${appointmentId}/edit`}>
                <div className="flex flex-col items-center gap-2">
                  <Pencil className="h-6 w-6 text-[#09919b]" />
                  <span className="text-sm font-semibold">Editar Cita</span>
                </div>
              </Link>
            </Button>
            {patient && (
              <Button variant="outline" size="lg" className="h-auto py-4" asChild>
                <Link href={`/dashboard/patients/${patient.id}`}>
                  <div className="flex flex-col items-center gap-2">
                    <User className="h-6 w-6 text-[#09919b]" />
                    <span className="text-sm font-semibold">Ver Paciente</span>
                  </div>
                </Link>
              </Button>
            )}
            <Button variant="outline" size="lg" className="h-auto py-4" asChild>
              <Link href="/dashboard/schedule">
                <div className="flex flex-col items-center gap-2">
                  <Calendar className="h-6 w-6 text-[#09919b]" />
                  <span className="text-sm font-semibold">Ver Agenda</span>
                </div>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
