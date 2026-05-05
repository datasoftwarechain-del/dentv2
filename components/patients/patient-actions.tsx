"use client";

import { Button } from "@/components/ui/button";
import { EditPatientDialog } from "@/components/patients/edit-patient-dialog";
import { CreateAppointmentDialog } from "@/components/dashboard/create-appointment-dialog";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { Plus } from "lucide-react";

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
}interface Lab {
    id: string;
    name: string;
}

interface PatientActionsProps {
    patient: Patient;
    organizationId: string;
    labs: Lab[];
}

export function PatientActions({ patient, organizationId, labs }: PatientActionsProps) {
    return (
        <>
            {/* Edit Profile Button */}
            <div className="pt-4">
                <EditPatientDialog patient={patient}>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 shadow-lg">
                        Editar Perfil
                    </Button>
                </EditPatientDialog>
            </div>

            {/* Hidden components for Future Nueva Cita and Nueva Orden buttons */}
        </>
    );
}

interface AppointmentActionsProps {
    patient: Patient;
    organizationId: string;
}

export function AppointmentActions({ patient, organizationId }: AppointmentActionsProps) {
    return (
        <CreateAppointmentDialog
            organizationId={organizationId}
            patients={[patient]}
        >
            <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
                <Plus className="h-3 w-3" /> Nueva Cita
            </Button>
        </CreateAppointmentDialog>
    );
}

interface OrderActionsProps {
    patient: Patient;
    organizationId: string;
    labs: Lab[];
    showPrices?: boolean;
}

export function OrderActions({ patient, organizationId, labs, showPrices = true }: OrderActionsProps) {
    return (
        <CreateOrderDialog
            organizationId={organizationId}
            patients={[patient]}
            labs={labs}
            showPrices={showPrices}
        >
            <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
                <Plus className="h-3 w-3" /> Nueva Orden
            </Button>
        </CreateOrderDialog>
    );
}
