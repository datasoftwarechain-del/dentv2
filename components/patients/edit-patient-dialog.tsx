"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, User, Mail, Phone, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
}

interface EditPatientDialogProps {
    patient: Patient;
    children?: React.ReactNode;
}

export function EditPatientDialog({ patient, children }: EditPatientDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        firstName: patient.first_name || "",
        lastName: patient.last_name || "",
        email: patient.email || "",
        phone: patient.phone || "",
        dateOfBirth: patient.date_of_birth || "",
    });

    async function handleUpdatePatient(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            const { error: updateError } = await supabase
                .from("patients")
                .update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email || null,
                    phone: formData.phone || null,
                    date_of_birth: formData.dateOfBirth || null,
                })
                .eq("id", patient.id);

            if (updateError) {
                setError("Error al actualizar paciente: " + updateError.message);
                return;
            }

            setOpen(false);
            router.refresh();
        } catch (err) {
            setError("Error inesperado al actualizar paciente");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="outline">
                        <User className="mr-2 h-4 w-4" />
                        Editar Paciente
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-border bg-background/95 backdrop-blur-xl shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                        Editar Paciente
                    </DialogTitle>
                    <DialogDescription className="text-sm font-medium text-muted-foreground">
                        Actualiza la información del paciente.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleUpdatePatient} className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <User className="inline h-3 w-3 mr-1" />
                                Nombre
                            </Label>
                            <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                required
                                placeholder="Juan"
                                className="bg-background border-border/50 focus:border-primary transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Apellido
                            </Label>
                            <Input
                                id="lastName"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                required
                                placeholder="Pérez"
                                className="bg-background border-border/50 focus:border-primary transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <Mail className="inline h-3 w-3 mr-1" />
                            Correo Electrónico
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="paciente@ejemplo.com"
                            className="bg-background border-border/50 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <Phone className="inline h-3 w-3 mr-1" />
                            Teléfono
                        </Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 234 567 8900"
                            className="bg-background border-border/50 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dateOfBirth" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <Calendar className="inline h-3 w-3 mr-1" />
                            Fecha de Nacimiento
                        </Label>
                        <Input
                            id="dateOfBirth"
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                            className="bg-background border-border/50 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border/50">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="font-bold"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all font-bold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                "Guardar Cambios"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
