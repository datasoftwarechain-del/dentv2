"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreatePatientDialog } from "@/components/dashboard/create-patient-dialog";
import { CreateOrderDialog } from "@/components/dashboard/create-order-dialog";
import { CreateAppointmentDialog } from "@/components/dashboard/create-appointment-dialog";
import {
    Calendar,
    PlusCircle,
    UserPlus,
    ClipboardList
} from "lucide-react";
import Link from "next/link";

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
}

interface Lab {
    id: string;
    name: string;
}

interface QuickActionsProps {
    organizationId: string;
    patients: Patient[];
    labs: Lab[];
}

export function QuickActions({ organizationId, patients, labs }: QuickActionsProps) {
    return (
        <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Acciones Rápidas</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CreatePatientDialog organizationId={organizationId}>
                    <Button className="w-full h-auto py-6 flex-col gap-2 rounded-2xl bg-background shadow-sm border border-border/50 hover:shadow-md hover:border-primary/50 text-foreground group transition-all duration-300">
                        <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserPlus className="h-5 w-5 text-secondary" />
                        </div>
                        <span className="font-semibold">Nuevo Paciente</span>
                    </Button>
                </CreatePatientDialog>

                {/* New Order */}
                <CreateOrderDialog organizationId={organizationId} patients={patients} labs={labs}>
                    <Button className="w-full h-auto py-6 flex-col gap-2 rounded-2xl bg-background shadow-sm border border-border/50 hover:shadow-md hover:border-primary/50 text-foreground group transition-all duration-300">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <PlusCircle className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold">Crear Pedido</span>
                    </Button>
                </CreateOrderDialog>

                {/* New Appointment */}
                <CreateAppointmentDialog organizationId={organizationId} patients={patients}>
                    <Button className="w-full h-auto py-6 flex-col gap-2 rounded-2xl bg-background shadow-sm border border-border/50 hover:shadow-md hover:border-primary/50 text-foreground group transition-all duration-300">
                        <div className="h-10 w-10 rounded-xl bg-[#d2f2f3] flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Calendar className="h-5 w-5 text-[#09919b]" />
                        </div>
                        <span className="font-semibold">Agendar Cita</span>
                    </Button>
                </CreateAppointmentDialog>

                {/* View Orders */}
                <Link href="/dashboard/orders">
                    <Button className="w-full h-auto py-6 flex-col gap-2 rounded-2xl bg-background shadow-sm border border-border/50 hover:shadow-md hover:border-primary/50 text-foreground group transition-all duration-300">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ClipboardList className="h-5 w-5 text-emerald-600" />
                        </div>
                        <span className="font-semibold">Ver Pedidos</span>
                    </Button>
                </Link>
            </div>
        </section>
    );
}
