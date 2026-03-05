"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Loader2, Calendar, Clock, User, FileText } from "lucide-react";

const editAppointmentSchema = z.object({
  patientId: z.string().min(1, "Seleccioná un paciente"),
  date: z.string().min(1, "La fecha es requerida"),
  time: z.string().min(1, "La hora es requerida"),
  duration: z.string(),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]),
  notes: z.string().optional(),
});

type EditAppointmentValues = z.infer<typeof editAppointmentSchema>;

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface EditAppointmentFormProps {
  appointment: {
    id: string;
    patient_id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    notes: string | null;
    dentist_org_id: string;
  };
  patients: Patient[];
  organizationId: string;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export function EditAppointmentForm({
  appointment,
  patients,
  organizationId,
}: EditAppointmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Parse existing scheduled_at into date and time parts
  const scheduledDate = new Date(appointment.scheduled_at);
  const defaultDate = scheduledDate.toISOString().split("T")[0];
  const defaultTime = `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(
    scheduledDate.getMinutes()
  ).padStart(2, "0")}`;

  const form = useForm<EditAppointmentValues>({
    resolver: zodResolver(editAppointmentSchema),
    defaultValues: {
      patientId: appointment.patient_id,
      date: defaultDate,
      time: defaultTime,
      duration: String(appointment.duration_minutes),
      status: appointment.status as EditAppointmentValues["status"],
      notes: appointment.notes || "",
    },
  });

  async function onSubmit(values: EditAppointmentValues) {
    setLoading(true);
    try {
      const supabase = createClient();

      const scheduledAt = new Date(`${values.date}T${values.time}:00`).toISOString();

      const { error } = await supabase
        .from("appointments")
        .update({
          patient_id: values.patientId,
          scheduled_at: scheduledAt,
          duration_minutes: parseInt(values.duration),
          status: values.status,
          notes: values.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id)
        .eq("dentist_org_id", organizationId);

      if (error) throw error;

      toast.success("Cita actualizada correctamente");
      router.push(`/dashboard/appointments/${appointment.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la cita");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-2 border-[#b0dde0] shadow-premium">
      <CardHeader className="bg-gradient-to-br from-[#f0fafb] to-white border-b border-[#d2f2f3]">
        <CardTitle className="text-xl font-bold text-[#044c64]">Editar Cita</CardTitle>
        <CardDescription>Actualizá los datos de esta cita médica</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Patient selector */}
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#09919b]" />
                    Paciente
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={patients.map((p) => ({
                        value: p.id,
                        label: `${p.first_name} ${p.last_name}`,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Seleccioná un paciente"
                      searchPlaceholder="Buscar paciente..."
                      emptyText="No se encontró el paciente."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#09919b]" />
                      Fecha
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#09919b]" />
                      Hora
                    </FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#09919b]" />
                    Duración
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1.5 horas</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#09919b]" />
                    Notas
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones sobre la cita..."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
