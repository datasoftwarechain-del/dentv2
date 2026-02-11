'use client'
import { Card, CardHeader } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Activity, Package, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ORDER_STATUS_GROUPS } from '@/lib/order-status';

interface ClientActivity {
    client: {
        id: string;
        name: string;
    };
    activeOrdersCount: number;
    readyForDeliveryCount: number;
    totalOrdersCount: number;
    lastActivityDate: Date;
}

export function ActiveClientCard({ orgId }: { orgId: string }) {
    const [clientData, setClientData] = useState<ClientActivity | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActiveClient = async () => {
            const supabase = createClient();

            // Get all orders from the last 30 days with active statuses
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: orders } = await supabase
                .from('lab_orders')
                .select(`
                    dentist_org_id,
                    status,
                    updated_at,
                    dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name)
                `)
                .eq('lab_org_id', orgId)
                .in('status', [...ORDER_STATUS_GROUPS.active, ...ORDER_STATUS_GROUPS.completed])
                .gte('updated_at', thirtyDaysAgo.toISOString());

            if (orders && orders.length > 0) {
                // Group by client and calculate metrics
                const clientMap = orders.reduce((acc: any, order: any) => {
                    const org = Array.isArray(order.dentist_org) ? order.dentist_org[0] : order.dentist_org;
                    if (!org) return acc;

                    const id = order.dentist_org_id;
                    if (!acc[id]) {
                        acc[id] = {
                            client: org,
                            activeOrdersCount: 0,
                            readyForDeliveryCount: 0,
                            totalOrdersCount: 0,
                            lastActivityDate: order.updated_at
                        };
                    }

                    // Count active orders (in_production, quality_check)
                    if (ORDER_STATUS_GROUPS.active.includes(order.status as any)) {
                        acc[id].activeOrdersCount++;
                    }

                    // Count ready orders
                    if (ORDER_STATUS_GROUPS.completed.includes(order.status as any)) {
                        acc[id].readyForDeliveryCount++;
                    }

                    // Total orders
                    acc[id].totalOrdersCount++;

                    // Track most recent activity
                    if (new Date(order.updated_at) > new Date(acc[id].lastActivityDate)) {
                        acc[id].lastActivityDate = order.updated_at;
                    }

                    return acc;
                }, {});

                // Get client with most active orders
                const topClient = Object.values(clientMap)
                    .sort((a: any, b: any) => {
                        // Sort by active orders first, then by total orders
                        if (b.activeOrdersCount !== a.activeOrdersCount) {
                            return b.activeOrdersCount - a.activeOrdersCount;
                        }
                        return b.totalOrdersCount - a.totalOrdersCount;
                    })[0] as ClientActivity;

                setClientData(topClient);
            }
            setLoading(false);
        };

        fetchActiveClient();
    }, [orgId]);

    if (loading) {
        return (
            <Card className="border border-border/50 shadow-premium">
                <div className="p-6 flex items-center justify-center">
                    <div className="animate-spin text-xl">⏳</div>
                </div>
            </Card>
        );
    }

    if (!clientData) {
        return (
            <Card className="border border-border/50 shadow-premium">
                <div className="p-6">
                    <p className="text-sm text-muted-foreground text-center">
                        No hay clientes activos
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <p className="text-xs font-bold uppercase text-muted-foreground/70">Cliente Más Activo</p>
                <Users className="h-5 w-5 text-primary" />
            </CardHeader>

            <div className="px-6 pb-6">
                <h4 className="text-lg font-bold mb-3 truncate" title={clientData.client.name}>
                    {clientData.client.name}
                </h4>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-primary/5 p-2 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Package className="h-3 w-3 text-primary" />
                            <span className="text-xs font-medium text-primary">Activos</span>
                        </div>
                        <div className="text-xl font-bold text-primary">
                            {clientData.activeOrdersCount}
                        </div>
                    </div>

                    <div className="bg-secondary/5 p-2 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Clock className="h-3 w-3 text-secondary" />
                            <span className="text-xs font-medium text-secondary">Listos</span>
                        </div>
                        <div className="text-xl font-bold text-secondary">
                            {clientData.readyForDeliveryCount}
                        </div>
                    </div>
                </div>

                {/* Last Activity */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    <span>
                        Última actividad: {formatDistanceToNow(new Date(clientData.lastActivityDate), {
                            addSuffix: true,
                            locale: es
                        })}
                    </span>
                </div>
            </div>
        </Card>
    );
}
