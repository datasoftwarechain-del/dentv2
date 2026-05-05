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
    showPrices?: boolean;
}

export function QuickActions({ organizationId, patients, labs, showPrices = true }: QuickActionsProps) {
    return (
        <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Acciones Rápidas</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <CreatePatientDialog organizationId={organizationId}>
                    <Button variant="ghost" className="w-full h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2 rounded-2xl bg-white shadow-sm border border-border/40 hover:bg-[#f5fbfc] hover:border-[#b0dde0] hover:shadow-md data-[state=open]:bg-[#e0f4f6] data-[state=open]:border-[#09919b]/40 text-foreground group transition-all duration-200">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#e0f4f6] flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-[#09919b]" />
                        </div>
                        <span className="font-semibold text-xs sm:text-sm">Nuevo Paciente</span>
                    </Button>
                </CreatePatientDialog>

                {/* New Order */}
                <CreateOrderDialog organizationId={organizationId} patients={patients} labs={labs} showPrices={showPrices}>
                    <Button variant="ghost" className="w-full h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2 rounded-2xl bg-white shadow-sm border border-border/40 hover:bg-[#f5fbfc] hover:border-[#b0dde0] hover:shadow-md data-[state=open]:bg-[#e0f4f6] data-[state=open]:border-[#09919b]/40 text-foreground group transition-all duration-200">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#d2f2f3] flex items-center justify-center group-hover:scale-110 transition-transform">
                            <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5 text-[#044c64]" />
                        </div>
                        <span className="font-semibold text-xs sm:text-sm">Crear Pedido</span>
                    </Button>
                </CreateOrderDialog>

                {/* New Appointment */}
                <CreateAppointmentDialog organizationId={organizationId} patients={patients}>
                    <Button variant="ghost" className="w-full h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2 rounded-2xl bg-white shadow-sm border border-border/40 hover:bg-[#f5fbfc] hover:border-[#b0dde0] hover:shadow-md data-[state=open]:bg-[#e0f4f6] data-[state=open]:border-[#09919b]/40 text-foreground group transition-all duration-200">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#d2f2f3] flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-[#09919b]" />
                        </div>
                        <span className="font-semibold text-xs sm:text-sm">Agendar Cita</span>
                    </Button>
                </CreateAppointmentDialog>

                {/* View Orders */}
                <Link href="/dashboard/orders">
                    <Button variant="ghost" className="w-full h-auto py-4 sm:py-6 flex-col gap-1.5 sm:gap-2 rounded-2xl bg-white shadow-sm border border-border/40 hover:bg-[#f5fbfc] hover:border-[#b0dde0] hover:shadow-md text-foreground group transition-all duration-200">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#d2f2f3] flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-[#09919b]" />
                        </div>
                        <span className="font-semibold text-xs sm:text-sm">Ver Pedidos</span>
                    </Button>
                </Link>
            </div>
        </section>
    );
}
