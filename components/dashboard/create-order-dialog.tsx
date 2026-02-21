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

            toast.success("Orden creada exitosamente", {
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
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all duration-200">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Orden
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-[660px] p-0 border-border bg-background shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

                {/* ── Brand header ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#044c64] via-[#0d687d] to-[#09919b] px-6 py-5 shrink-0">
                    {/* Elegant radial glow — subtle, no grid pattern */}
                    <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
                    <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[#43eada]/10 blur-xl" />
                    {/* Thin accent line at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <img src="/logo.png" alt="DigitalDent" className="h-5 w-5 rounded" />
                                <span className="text-[10px] font-bold text-white/45 uppercase tracking-[0.2em]">DigitalDent · Lab</span>
                            </div>
                            <h2 className="text-[19px] font-bold text-white leading-tight">
                                {mode === 'lab' ? 'Registrar Orden Manual' : 'Nueva Orden de Laboratorio'}
                            </h2>
                        </div>
                        <div className="text-right shrink-0 ml-4 mt-0.5">
                            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">N° Orden</p>
                            <div className="h-7 w-16 rounded-md border border-white/15 bg-white/8 flex items-center justify-center">
                                <span className="text-[11px] font-mono font-bold text-white/35">AUTO</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Form body ── */}
                <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 space-y-5">

                        {/* Section 01 · Dr / Clínica + Paciente */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">01</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">Partes</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Paciente */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                            Paciente {mode === 'lab' && <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">(opcional)</span>}
                                        </Label>
                                        <label htmlFor="manualPatient" className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id="manualPatient"
                                                checked={useManualPatient}
                                                onChange={(e) => {
                                                    setUseManualPatient(e.target.checked);
                                                    if (e.target.checked) setFormData({ ...formData, patientId: '' });
                                                }}
                                                className="h-3 w-3 rounded border-[#b0dde0] accent-[#09919b]"
                                            />
                                            <span className="text-[10px] text-[#09919b]">Nuevo</span>
                                        </label>
                                    </div>
                                    {useManualPatient ? (
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                            <Input placeholder="Nombre completo" value={manualPatientName}
                                                onChange={(e) => setManualPatientName(e.target.value)}
                                                className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                required={useManualPatient} />
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b] z-10" />
                                            <Select value={formData.patientId}
                                                onValueChange={(v) => setFormData({ ...formData, patientId: v })}
                                                required={!useManualPatient && mode !== 'lab'}>
                                                <SelectTrigger className="pl-8 h-9 text-sm border-[#b0dde0] focus:border-[#09919b]">
                                                    <SelectValue placeholder="Seleccionar paciente" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {patients.length > 0 ? patients.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                                                    )) : <div className="px-2 py-4 text-center text-xs text-muted-foreground">Sin pacientes</div>}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                {/* Clínica / Laboratorio */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                            {mode === "dentist" ? "Laboratorio" : "Dr / Clínica"}
                                        </Label>
                                        {mode === 'lab' && (
                                            <label htmlFor="manualClinic" className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" id="manualClinic" checked={useManualClinic}
                                                    onChange={(e) => {
                                                        setUseManualClinic(e.target.checked);
                                                        if (e.target.checked) setFormData({ ...formData, targetOrgId: '' });
                                                    }}
                                                    className="h-3 w-3 rounded border-[#b0dde0] accent-[#09919b]" />
                                                <span className="text-[10px] text-[#09919b]">Nuevo</span>
                                            </label>
                                        )}
                                        {mode === 'dentist' && <div className="h-4" />}
                                    </div>
                                    {useManualClinic ? (
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                            <Input placeholder="Nombre clínica o dentista" value={manualClinicName}
                                                onChange={(e) => setManualClinicName(e.target.value)}
                                                className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                required={useManualClinic} />
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b] z-10" />
                                            <Select value={formData.targetOrgId}
                                                onValueChange={(v) => setFormData({ ...formData, targetOrgId: v })}
                                                required={!useManualClinic}>
                                                <SelectTrigger className="pl-8 h-9 text-sm border-[#b0dde0] focus:border-[#09919b]">
                                                    <SelectValue placeholder={mode === "dentist" ? "Seleccionar Lab" : "Seleccionar Clínica"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {labs.length > 0 ? labs.map(l => (
                                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                                    )) : <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                        {mode === "dentist" ? "Sin laboratorios" : "Sin clínicas"}
                                                    </div>}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 02 · Trabajo */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">02</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">Trabajo</span>
                            </div>

                            {/* Tipo de trabajo — full width */}
                            <div className="space-y-1.5 mb-4">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">Tipo de Trabajo</Label>
                                <div className="relative">
                                    <Ticket className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b] z-10" />
                                    <Select value={formData.workType}
                                        onValueChange={(v) => setFormData({ ...formData, workType: v })} required>
                                        <SelectTrigger className="pl-8 h-9 text-sm border-[#b0dde0] focus:border-[#09919b]">
                                            <SelectValue placeholder="Selecciona el tipo de trabajo" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[260px]">
                                            {workTypes.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Piezas + Color */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">Piezas Dentales</Label>
                                    <div className="relative">
                                        <Info className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                        <Input id="toothNumbers" placeholder="Ej: 11, 21, 22"
                                            className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                            value={formData.toothNumbers}
                                            onChange={(e) => setFormData({ ...formData, toothNumbers: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">Color / Tono</Label>
                                    <Input id="shade" placeholder="Ej: A2, Bleach, OM2"
                                        className="h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                        value={formData.shade}
                                        onChange={(e) => setFormData({ ...formData, shade: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Section 03 · Fecha de Entrega */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">03</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">Fecha de Entrega</span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">Fecha</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                        <Input id="dueDate" type="date"
                                            className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                            value={formData.dueDate}
                                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                                    </div>
                                </div>
                                <div className="col-span-1 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">Hora</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                        <Input id="dueTime" type="time"
                                            className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                            value={formData.dueTime}
                                            onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })} />
                                    </div>
                                </div>
                                <div className="col-span-1 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">Prioridad</Label>
                                    <Select value={formData.priority}
                                        onValueChange={(v: any) => setFormData({ ...formData, priority: v })}>
                                        <SelectTrigger className="h-9 text-sm border-[#b0dde0] focus:border-[#09919b]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Baja</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="high">Alta</SelectItem>
                                            <SelectItem value="urgent">Urgente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Section 04 · Descripción */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">04</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">Descripción</span>
                            </div>
                            <div className="relative rounded-xl border border-[#b0dde0] bg-[#f5fbfc] overflow-hidden">
                                <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-[#09919b]/50" />
                                <Textarea
                                    id="notes"
                                    className="pl-8 min-h-[110px] bg-transparent border-0 text-sm text-foreground placeholder:text-[#09919b]/30 focus-visible:ring-0 resize-none"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Diseño, materiales, instrucciones especiales..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Footer actions ── */}
                    <div className="px-6 py-4 border-t border-[#d2f2f3] bg-[#f5fbfc] flex items-center justify-between shrink-0">
                        <p className="text-[10px] text-[#09919b]/50 font-medium">
                            El número de orden se asigna automáticamente
                        </p>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="ghost" size="sm"
                                onClick={() => setOpen(false)}
                                className="text-sm text-muted-foreground hover:text-foreground h-9">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading} size="sm"
                                className="h-9 px-5 bg-[#044c64] hover:bg-[#0d687d] text-white text-sm font-semibold shadow-md shadow-[#044c64]/20 transition-all">
                                {loading
                                    ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Creando...</>
                                    : <><Plus className="mr-1.5 h-3.5 w-3.5" />Crear Orden</>
                                }
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
