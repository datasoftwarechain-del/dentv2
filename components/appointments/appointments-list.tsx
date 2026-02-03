"use client";

import { CreateAppointmentDialog } from "@/components/dashboard/create-appointment-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, User } from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  patient: Patient;
}

interface AppointmentsListProps {
  appointments: Appointment[];
  patients: Patient[];
  organizationId: string;
}

const statusLabels: Record<string, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No Asistió",
};

const statusStyles: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  confirmed: "bg-green-500/10 text-green-500 border-green-500/20",
  completed: "bg-accent/10 text-accent border-accent/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  no_show: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

export function AppointmentsList({
  appointments,
  patients,
  organizationId,
}: AppointmentsListProps) {
  const upcomingAppointments = appointments.filter(
    (a) => new Date(a.scheduled_at) >= new Date() && a.status !== "cancelled"
  );

  // Sort upcoming by date ascending
  upcomingAppointments.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const pastAppointments = appointments.filter(
    (a) => new Date(a.scheduled_at) < new Date() || a.status === "cancelled"
  );

  // Sort past by date descending
  pastAppointments.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  function AppointmentCard({ appointment }: { appointment: Appointment }) {
    const date = new Date(appointment.scheduled_at);
    return (
      <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 transition-all hover:shadow-lg hover:border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/10 group-hover:from-accent/20 group-hover:to-accent/5 group-hover:text-accent transition-all">
            <span className="text-xs font-medium uppercase tracking-wider">
              {date.toLocaleDateString("es-ES", { month: "short" })}
            </span>
            <span className="text-xl font-bold">{date.getDate()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <p className="font-medium text-lg leading-none">
                {appointment.patient.first_name} {appointment.patient.last_name}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
              <div className="flex items-center gap-1.5 bg-background/50 px-2 py-0.5 rounded-md border border-border/50">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {date.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className="text-muted-foreground/40">•</span>
              <span>{appointment.duration_minutes} min</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${statusStyles[appointment.status] || "bg-muted text-muted-foreground border-muted"}`}
          >
            {statusLabels[appointment.status] || appointment.status}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="border-0 shadow-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                Próximas Citas
              </CardTitle>
              <CardDescription>
                Agenda del día y próximos eventos
              </CardDescription>
            </div>
            <CreateAppointmentDialog
              organizationId={organizationId}
              patients={patients}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {upcomingAppointments.length > 0 ? (
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted shadow-sm mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No hay citas próximas</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                No tienes citas programadas para los próximos días. ¡Aprovecha para descansar o adelantar trabajo!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {pastAppointments.length > 0 && (
        <Card className="border-0 shadow-sm bg-white/30 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">Historial Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
              {pastAppointments.slice(0, 3).map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
