"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Loader2, Calendar, Clock, User, FileText, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
}

interface CreateAppointmentDialogProps {
    organizationId: string;
    patients: Patient[];
    children?: React.ReactNode;
}

export function CreateAppointmentDialog({ organizationId, patients, children }: CreateAppointmentDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [useManualPatient, setUseManualPatient] = useState(false);
    const [newPatient, setNewPatient] = useState({ first_name: "", last_name: "" });
    const [formData, setFormData] = useState({
        patientId: "",
        date: "",
        time: "",
        duration: "30",
        notes: "",
        status: "scheduled"
    });

    async function handleCreateAppointment(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const supabase = createClient();
            let patientId = formData.patientId;

            if (useManualPatient) {
                const { data: created, error: patientError } = await supabase
                    .from("patients")
                    .insert({
                        first_name: newPatient.first_name.trim(),
                        last_name: newPatient.last_name.trim(),
                        dentist_org_id: organizationId,
                    })
                    .select("id")
                    .single();
                if (patientError) throw patientError;
                patientId = created.id;
            }

            // Combine date and time
            const scheduledAt = new Date(`${formData.date}T${formData.time}:00`).toISOString();

            const { error } = await supabase.from("appointments").insert({
                dentist_org_id: organizationId,
                patient_id: patientId,
                scheduled_at: scheduledAt,
                duration_minutes: parseInt(formData.duration),
                status: formData.status,
                notes: formData.notes || null,
            });

            if (error) throw error;

            setOpen(false);
            setFormData({ patientId: "", date: "", time: "", duration: "30", notes: "", status: "scheduled" });
            setNewPatient({ first_name: "", last_name: "" });
            setUseManualPatient(false);
            toast.success("Cita agendada correctamente");
            router.refresh();

        } catch (error: any) {
            toast.error(error.message || "Error al crear la cita");
            console.error("Error creating appointment:", error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300">
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Cita
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                        Agendar Cita
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Programa una nueva cita para un paciente.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateAppointment} className="space-y-6 mt-4">

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="patientId" className="text-foreground">Paciente</Label>
                            <button
                                type="button"
                                onClick={() => {
                                    setUseManualPatient(!useManualPatient);
                                    setFormData({ ...formData, patientId: "" });
                                    setNewPatient({ first_name: "", last_name: "" });
                                }}
                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                {useManualPatient ? "Seleccionar existente" : "Crear nuevo paciente"}
                            </button>
                        </div>

                        {useManualPatient ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nombre"
                                        className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                        value={newPatient.first_name}
                                        onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <Input
                                    placeholder="Apellido"
                                    className="bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                    value={newPatient.last_name}
                                    onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                                    required
                                />
                            </div>
                        ) : (
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                                <Select
                                    value={formData.patientId}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, patientId: value })
                                    }
                                    required
                                >
                                    <SelectTrigger className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                        <SelectValue placeholder="Seleccionar Paciente" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border text-foreground">
                                        {patients.map((patient) => (
                                            <SelectItem key={patient.id} value={patient.id} className="focus:bg-muted focus:text-foreground">
                                                {patient.first_name} {patient.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-foreground">Fecha</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="date"
                                    type="date"
                                    className="pl-9 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                    value={formData.date}
                                    onChange={(e) =>
                                        setFormData({ ...formData, date: e.target.value })
                                    }
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="time" className="text-foreground">Hora</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="time"
                                    type="time"
                                    className="pl-9 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                    value={formData.time}
                                    onChange={(e) =>
                                        setFormData({ ...formData, time: e.target.value })
                                    }
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="duration" className="text-foreground">Duración</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                            <Select
                                value={formData.duration}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, duration: value })
                                }
                            >
                                <SelectTrigger className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border text-foreground">
                                    <SelectItem value="15" className="focus:bg-muted focus:text-foreground">15 minutos</SelectItem>
                                    <SelectItem value="30" className="focus:bg-muted focus:text-foreground">30 minutos</SelectItem>
                                    <SelectItem value="45" className="focus:bg-muted focus:text-foreground">45 minutos</SelectItem>
                                    <SelectItem value="60" className="focus:bg-muted focus:text-foreground">1 hora</SelectItem>
                                    <SelectItem value="90" className="focus:bg-muted focus:text-foreground">1.5 horas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-foreground">Notas Adicionales</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                                id="notes"
                                className="pl-9 min-h-[100px] bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all resize-none"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder="Detalles sobre la cita..."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status" className="text-foreground">Estado Inicial</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) =>
                                setFormData({ ...formData, status: value })
                            }
                        >
                            <SelectTrigger className="bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border text-foreground">
                                <SelectItem value="scheduled" className="focus:bg-muted">Programada</SelectItem>
                                <SelectItem value="confirmed" className="focus:bg-muted">Confirmada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="hover:bg-muted"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agendar Cita
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
