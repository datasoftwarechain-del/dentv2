"use client";

import React, { useState } from "react";
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
import { Plus, Loader2, User, Building2, Ticket, Calendar, FileText, Info } from "lucide-react";

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
}

interface Organization {
    id: string;
    name: string;
}

interface CreateOrderDialogProps {
    organizationId: string;
    patients: Patient[];
    labs: Organization[];
    children?: React.ReactNode;
}

const workTypes = [
    { value: "corona_metal_ceramica", label: "Corona Metal-Cerámica" },
    { value: "corona_zirconia", label: "Corona Zirconia" },
    { value: "corona_emax", label: "Corona Emax" },
    { value: "puente_fijo", label: "Puente Fijo" },
    { value: "protesis_removible", label: "Prótesis Removible" },
    { value: "protesis_total", label: "Prótesis Total" },
    { value: "implante_corona", label: "Corona sobre Implante" },
    { value: "carilla", label: "Carilla" },
    { value: "incrustacion", label: "Incrustación" },
    { value: "ferula", label: "Férula" },
    { value: "retenedor", label: "Retenedor" },
    { value: "reparacion", label: "Reparación" },
    { value: "otro", label: "Otro" },
];

export function CreateOrderDialog({ organizationId, patients, labs, children }: CreateOrderDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        patientId: "",
        labId: "",
        workType: "",
        toothNumbers: "",
        shade: "",
        notes: "",
        dueDate: "",
    });

    // Debug: Log labs when component mounts or labs change
    React.useEffect(() => {
        console.log("CreateOrderDialog - Labs received:", labs);
    }, [labs]);

    async function handleCreateOrder(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const supabase = createClient();

            // 1. Generate order number (backend trigger might handle this, but let's rely on backend trigger if it exists)
            // The schema said: trigger set_order_number BEFORE INSERT ... check if null.
            // So we can just omit it or send null/empty if the trigger is active.

            // 2. Insert into lab_orders
            const { data: orderData, error: orderError } = await supabase
                .from("lab_orders")
                .insert({
                    dentist_org_id: organizationId,
                    lab_org_id: formData.labId,
                    patient_id: formData.patientId,
                    due_date: formData.dueDate || null,
                    notes: formData.notes || null,
                    status: "received", // pending/draft/received depending on flow. 'received' seems default in schema.
                    priority: "normal",
                })
                .select()
                .single();

            if (orderError) throw orderError;
            if (!orderData) throw new Error("No se pudo crear la orden");

            // 3. Insert into lab_order_items
            // Convert comma separated tooth numbers to array if present
            const toothArray = formData.toothNumbers
                ? formData.toothNumbers.split(',').map(s => s.trim()).filter(Boolean)
                : [];

            const { error: itemError } = await supabase
                .from("lab_order_items")
                .insert({
                    order_id: orderData.id,
                    work_type: formData.workType,
                    tooth_positions: toothArray.length > 0 ? toothArray : null,
                    shade: formData.shade || null,
                    quantity: 1, // Default to 1 for now
                    notes: formData.notes || null // Copy notes to item or keep separate? distinct is better but simplified here.
                });

            if (itemError) {
                // If item creation fails, we might want to cleanup the order or alert. 
                // For MVP, throwing error to catch block.
                console.error("Error creating item", itemError);
                throw itemError;
            }

            setOpen(false);
            setFormData({
                patientId: "",
                labId: "",
                workType: "",
                toothNumbers: "",
                shade: "",
                notes: "",
                dueDate: "",
            });
            router.refresh();

        } catch (error) {
            console.error("Error creating order:", error);
            // Optional: Show error toast here
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
                        Nuevo Pedido
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] border-border bg-background/95 backdrop-blur-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                        Crear Orden de Laboratorio
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Envía una nueva orden de trabajo a tu laboratorio dental.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateOrder} className="space-y-6 mt-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="patientId" className="text-foreground">Paciente</Label>
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
                                        <SelectValue placeholder="Seleccionar" />
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="labId" className="text-foreground">Laboratorio</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                                <Select
                                    value={formData.labId}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, labId: value })
                                    }
                                    required
                                >
                                    <SelectTrigger className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                        <SelectValue placeholder="Seleccionar Lab" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border text-foreground">
                                        {labs.length > 0 ? (
                                            labs.map((lab) => (
                                                <SelectItem key={lab.id} value={lab.id} className="focus:bg-muted focus:text-foreground">
                                                    {lab.name}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                                No hay laboratorios registrados
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="workType" className="text-foreground">Tipo de Trabajo</Label>
                        <div className="relative">
                            <Ticket className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                            <Select
                                value={formData.workType}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, workType: value })
                                }
                                required
                            >
                                <SelectTrigger className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                    <SelectValue placeholder="Selecciona el tipo de trabajo" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border text-foreground max-h-[300px]">
                                    {workTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value} className="focus:bg-muted focus:text-foreground">
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="toothNumbers" className="text-foreground">Piezas Dentales</Label>
                            <div className="relative">
                                <Info className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="toothNumbers"
                                    placeholder="Ej: 11, 21"
                                    className="pl-9 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                    value={formData.toothNumbers}
                                    onChange={(e) =>
                                        setFormData({ ...formData, toothNumbers: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="shade" className="text-foreground">Color / Tono</Label>
                            <Input
                                id="shade"
                                placeholder="Ej: A2, Bleach"
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                value={formData.shade}
                                onChange={(e) =>
                                    setFormData({ ...formData, shade: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dueDate" className="text-foreground">Fecha de Entrega Deseada</Label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="dueDate"
                                type="date"
                                className="pl-9 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                value={formData.dueDate}
                                onChange={(e) =>
                                    setFormData({ ...formData, dueDate: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-foreground">Instrucciones Adicionales</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                                id="notes"
                                className="pl-9 min-h-[100px] bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all resize-none"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder="Detalles sobre diseño, materiales, etc..."
                            />
                        </div>
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
                            className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Pedido
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
