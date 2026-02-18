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
import { Plus, Loader2, User, Building2, Ticket, Calendar, FileText, Info, Clock } from "lucide-react";
import { toast } from "sonner";

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
    mode?: "dentist" | "lab";
    defaultLabId?: string | null;
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

export function CreateOrderDialog({ organizationId, patients, labs, children, mode = "dentist", defaultLabId }: CreateOrderDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [useManualPatient, setUseManualPatient] = useState(false);
    const [manualPatientName, setManualPatientName] = useState('');
    const [useManualClinic, setUseManualClinic] = useState(false);
    const [manualClinicName, setManualClinicName] = useState('');
    const [formData, setFormData] = useState({
        patientId: "",
        targetOrgId: (mode === "dentist" && defaultLabId) ? defaultLabId : "",
        workType: "",
        toothNumbers: "",
        shade: "",
        notes: "",
        dueDate: "",
        dueTime: "",
        priority: "normal" as "low" | "normal" | "high" | "urgent",
    });

    // Debug: Log labs when component mounts or labs change
    React.useEffect(() => {
        console.log("CreateOrderDialog - props received:", { labs, mode });
    }, [labs, mode]);

    async function handleCreateOrder(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            // Validation
            if (!formData.workType) {
                toast.error("Por favor selecciona el tipo de trabajo");
                setLoading(false);
                return;
            }

            // For lab mode with manual clinic, require manual name
            if (mode === 'lab' && useManualClinic && !manualClinicName.trim()) {
                toast.error("Por favor ingresa el nombre de la clínica");
                setLoading(false);
                return;
            }

            // For non-manual clinic/lab entry, require the ID
            if (!useManualClinic && !formData.targetOrgId) {
                toast.error(mode === "dentist" ? "Por favor selecciona un laboratorio" : "Por favor selecciona una clínica");
                setLoading(false);
                return;
            }

            // If manual patient, require the name
            if (useManualPatient && !manualPatientName.trim()) {
                toast.error("Por favor ingresa el nombre del paciente");
                setLoading(false);
                return;
            }

            // If not manual patient entry, require patient ID
            if (!useManualPatient && !formData.patientId) {
                toast.error("Por favor selecciona un paciente");
                setLoading(false);
                return;
            }

            const supabase = createClient();

            // Handle clinic/dentist creation for manual entry (lab mode)
            let finalTargetOrgId = formData.targetOrgId;

            if (mode === 'lab' && useManualClinic && manualClinicName && !finalTargetOrgId) {
                // Create dentist organization on-the-fly as CLIENT RECORD (not system account)
                // is_system_account: false means this is passive tracking data only
                const { data: newOrg, error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        name: manualClinicName.trim(),
                        type: 'dentist',
                        is_system_account: false  // This is a client record, not a real system user
                    })
                    .select('id')
                    .single();

                if (orgError) {
                    console.error("Organization creation error:", orgError);
                    throw new Error(`Error al crear clínica: ${orgError.message || JSON.stringify(orgError)}`);
                }
                if (!newOrg) throw new Error("No se pudo crear la clínica");
                finalTargetOrgId = newOrg.id;

                // Create lab-dentist relationship
                const { error: relationError } = await supabase
                    .from('lab_dentist_relations')
                    .insert({
                        lab_org_id: organizationId,
                        dentist_org_id: finalTargetOrgId,
                        status: 'active'
                    });

                if (relationError) {
                    console.warn('Could not create lab-dentist relation:', relationError);
                    // Not critical, continue anyway
                }
            }

            // Determine IDs based on mode
            const dentistOrgId = mode === "dentist" ? organizationId : finalTargetOrgId;
            const labOrgId = mode === "dentist" ? finalTargetOrgId : organizationId;

            // Handle patient creation for manual entry (both lab and dentist mode)
            let finalPatientId = formData.patientId;

            if (useManualPatient && manualPatientName && !finalPatientId) {
                // Create patient on-the-fly linked to the dentist org
                const nameParts = manualPatientName.trim().split(' ');
                const firstName = nameParts[0] || manualPatientName;
                const lastName = nameParts.slice(1).join(' ') || '';

                const { data: newPatient, error: patientError } = await supabase
                    .from('patients')
                    .insert({
                        dentist_org_id: dentistOrgId,
                        first_name: firstName,
                        last_name: lastName,
                    })
                    .select('id')
                    .single();

                if (patientError) {
                    console.error("Patient creation error:", patientError);
                    throw new Error(`Error al crear paciente: ${patientError.message || JSON.stringify(patientError)}`);
                }
                if (!newPatient) throw new Error("No se pudo crear el paciente");
                finalPatientId = newPatient.id;
            }

            // For dentist mode: auto-create lab-dentist relation if selecting a new lab
            if (mode === 'dentist' && labOrgId) {
                await supabase
                    .from('lab_dentist_relations')
                    .upsert({
                        lab_org_id: labOrgId,
                        dentist_org_id: dentistOrgId,
                        status: 'active'
                    }, { onConflict: 'lab_org_id,dentist_org_id', ignoreDuplicates: true });
            }

            // 1. Generate sequential order number
            // Get the latest order number to generate the next one
            const { data: latestOrders } = await supabase
                .from("lab_orders")
                .select("order_number")
                .order("created_at", { ascending: false })
                .limit(100); // Get last 100 to find max number

            let nextOrderNumber = 1;

            if (latestOrders && latestOrders.length > 0) {
                // Extract numbers from existing order numbers (format: "ORDEN 123")
                const existingNumbers = latestOrders
                    .map(order => {
                        const match = order.order_number.match(/ORDEN (\d+)/);
                        return match ? parseInt(match[1], 10) : 0;
                    })
                    .filter(num => !isNaN(num));

                // Get the maximum number and increment
                if (existingNumbers.length > 0) {
                    nextOrderNumber = Math.max(...existingNumbers) + 1;
                }
            }

            const orderNumber = `ORDEN ${nextOrderNumber}`;

            // 2. Insert into lab_orders
            // Combine date and time into a full timestamp
            let dueDateTimestamp = null;
            if (formData.dueDate) {
                // If no time specified, use a sensible default (18:00 = 6 PM)
                const timeStr = formData.dueTime || "18:00";
                // Create ISO string in local timezone
                // Format: YYYY-MM-DDTHH:MM:SS
                dueDateTimestamp = `${formData.dueDate}T${timeStr}:00`;
            }

            const { data: orderData, error: orderError } = await supabase
                .from("lab_orders")
                .insert({
                    order_number: orderNumber,
                    dentist_org_id: dentistOrgId,
                    lab_org_id: labOrgId,
                    patient_id: finalPatientId || null, // Can be null for manual orders
                    due_date: dueDateTimestamp,
                    notes: formData.notes || null,
                    status: "received",
                    priority: formData.priority,
                })
                .select()
                .single();

            if (orderError) {
                console.error("Order creation error details:", orderError);
                throw new Error(`Error al crear orden: ${orderError.message || JSON.stringify(orderError)}`);
            }
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
                console.error("Item creation error details:", itemError);
                throw new Error(`Error al crear items de orden: ${itemError.message || JSON.stringify(itemError)}`);
            }

            // Success message with context
            let description = '';
            const created = [];
            if (mode === 'lab' && useManualClinic) created.push('Clínica');
            if (useManualPatient) created.push('Paciente');
            if (created.length > 0) {
                description = `${created.join(' y ')} creado${created.length > 1 ? 's' : ''} automáticamente`;
            }

            toast.success("Pedido creado exitosamente", {
                description: description || undefined
            });

            setOpen(false);
            setFormData({
                patientId: "",
                targetOrgId: (mode === "dentist" && defaultLabId) ? defaultLabId : "",
                workType: "",
                toothNumbers: "",
                shade: "",
                notes: "",
                dueDate: "",
                dueTime: "",
                priority: "normal",
            });
            setUseManualPatient(false);
            setManualPatientName('');
            setUseManualClinic(false);
            setManualClinicName('');
            router.refresh();

        } catch (error: any) {
            console.error("Error creating order:", error);
            const errorMessage = error?.message || "Error desconocido al crear el pedido";
            toast.error("Error al crear el pedido", {
                description: errorMessage
            });
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
                        Nueva Orden
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] border-border bg-background/95 backdrop-blur-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                        {mode === 'lab' ? 'Registrar Orden Manual' : 'Crear Orden de Laboratorio'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {mode === 'lab'
                            ? 'Ingresa una orden recibida en papel o por teléfono'
                            : 'Envía una nueva orden de trabajo a tu laboratorio dental'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateOrder} className="space-y-6 mt-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="patientId" className="text-foreground">
                                Paciente {mode === 'lab' && <span className="text-xs text-muted-foreground">(opcional)</span>}
                            </Label>

                            {/* Manual patient entry option for both lab and dentist mode */}
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="manualPatient"
                                    checked={useManualPatient}
                                    onChange={(e) => {
                                        setUseManualPatient(e.target.checked);
                                        if (e.target.checked) {
                                            setFormData({ ...formData, patientId: '' });
                                        }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor="manualPatient" className="text-xs text-muted-foreground cursor-pointer">
                                    Crear nuevo paciente
                                </Label>
                            </div>

                            {useManualPatient ? (
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nombre completo del paciente"
                                        value={manualPatientName}
                                        onChange={(e) => setManualPatientName(e.target.value)}
                                        className="pl-9 bg-background border-input text-foreground"
                                        required={useManualPatient}
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
                                        required={!useManualPatient && mode !== 'lab'}
                                    >
                                        <SelectTrigger className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                            {formData.patientId ? (
                                                <span className="text-left">
                                                    {(() => {
                                                        const selectedPatient = patients.find(p => p.id === formData.patientId);
                                                        return selectedPatient
                                                            ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
                                                            : "Seleccionar";
                                                    })()}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">Seleccionar</span>
                                            )}
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border text-foreground">
                                            {patients.length > 0 ? (
                                                patients.map((patient) => (
                                                    <SelectItem key={patient.id} value={patient.id} className="focus:bg-muted focus:text-foreground">
                                                        {patient.first_name} {patient.last_name}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                                    No hay pacientes registrados
                                                </div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="targetOrgId" className="text-foreground">
                                {mode === "dentist" ? "Laboratorio" : "Clínica / Dentista"}
                            </Label>

                            {/* Spacer to match the patient checkbox row height in dentist mode */}
                            {mode === 'dentist' && <div className="h-4 mb-2" />}

                            {/* Manual clinic entry option for lab mode */}
                            {mode === 'lab' && (
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        id="manualClinic"
                                        checked={useManualClinic}
                                        onChange={(e) => {
                                            setUseManualClinic(e.target.checked);
                                            if (e.target.checked) {
                                                setFormData({ ...formData, targetOrgId: '' });
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor="manualClinic" className="text-xs text-muted-foreground cursor-pointer">
                                        Clínica no está en el sistema
                                    </Label>
                                </div>
                            )}

                            {useManualClinic ? (
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nombre de la clínica o dentista"
                                        value={manualClinicName}
                                        onChange={(e) => setManualClinicName(e.target.value)}
                                        className="pl-9 bg-background border-input text-foreground"
                                        required={useManualClinic}
                                    />
                                </div>
                            ) : (
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                                    <Select
                                        value={formData.targetOrgId}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, targetOrgId: value })
                                        }
                                        required={!useManualClinic}
                                    >
                                        <SelectTrigger className="pl-9 bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                            {formData.targetOrgId ? (
                                                <span className="text-left">
                                                    {(() => {
                                                        const selectedLab = labs.find(l => l.id === formData.targetOrgId);
                                                        return selectedLab
                                                            ? selectedLab.name
                                                            : (mode === "dentist" ? "Seleccionar Lab" : "Seleccionar Clínica");
                                                    })()}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {mode === "dentist" ? "Seleccionar Lab" : "Seleccionar Clínica"}
                                                </span>
                                            )}
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
                                                    {mode === "dentist" ? "No hay laboratorios registrados" : "No hay clínicas registradas"}
                                                </div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dueDate" className="text-foreground">Fecha de Entrega</Label>
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
                            <Label htmlFor="dueTime" className="text-foreground">Hora de Entrega</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="dueTime"
                                    type="time"
                                    className="pl-9 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
                                    value={formData.dueTime}
                                    onChange={(e) =>
                                        setFormData({ ...formData, dueTime: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="priority" className="text-foreground">Prioridad</Label>
                        <Select
                            value={formData.priority}
                            onValueChange={(value: any) =>
                                setFormData({ ...formData, priority: value })
                            }
                        >
                            <SelectTrigger className="bg-background border-input text-foreground focus:border-primary focus:ring-primary/20 transition-all">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border text-foreground">
                                <SelectItem value="low" className="focus:bg-muted focus:text-foreground">
                                    Baja
                                </SelectItem>
                                <SelectItem value="normal" className="focus:bg-muted focus:text-foreground">
                                    Normal
                                </SelectItem>
                                <SelectItem value="high" className="focus:bg-muted focus:text-foreground">
                                    Alta
                                </SelectItem>
                                <SelectItem value="urgent" className="focus:bg-muted focus:text-foreground">
                                    Urgente
                                </SelectItem>
                            </SelectContent>
                        </Select>
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
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
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
