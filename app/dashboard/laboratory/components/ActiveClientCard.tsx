'use client'
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function ActiveClientCard({ orgId }: { orgId: string }) {
    const [clientData, setClientData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActiveClient = async () => {
            const supabase = createClient();
            const { data: orders } = await supabase
                .from('lab_orders')
                .select(`dentist_org_id, status, updated_at, dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name)`)
                .eq('lab_org_id', orgId)
                .in('status', ['in_production', 'quality_check', 'ready']);

            if (orders && orders.length > 0) {
                const grouped = orders.reduce((acc: any, order: any) => {
                    const org = Array.isArray(order.dentist_org) ? order.dentist_org[0] : order.dentist_org;
                    if (!org) return acc;
                    const id = order.dentist_org_id;
                    if (!acc[id]) acc[id] = { client: org, count: 0, ready: 0, lastActivity: order.updated_at };
                    if (['in_production', 'quality_check'].includes(order.status)) acc[id].count++;
                    if (order.status === 'ready') acc[id].ready++;
                    if (new Date(order.updated_at) > new Date(acc[id].lastActivity)) acc[id].lastActivity = order.updated_at;
                    return acc;
                }, {});
                const top = Object.values(grouped).sort((a: any, b: any) => b.count - a.count)[0] as any;
                setClientData(top);
            }
            setLoading(false);
        };
        fetchActiveClient();
    }, [orgId]);

    if (!clientData) return <Card className="p-6"><p className="text-sm text-muted-foreground">No hay clientes activos</p></Card>;

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <p className="text-xs font-bold uppercase text-muted-foreground/70">Cliente Activo</p>
                <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <div className="px-6 pb-6">
                <h4 className="text-lg font-bold mb-2">{clientData.client.name}</h4>
                <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">{clientData.count} activos</span>
                    {clientData.ready > 0 && <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">{clientData.ready} listos</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    Última: {formatDistanceToNow(new Date(clientData.lastActivity), { addSuffix: true, locale: es })}
                </p>
            </div>
        </Card>
    );
}
