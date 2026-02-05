'use client'
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, Clock, CheckCircle, TruckIcon } from 'lucide-react';

export function SummaryReportCard({ orgId }: { orgId: string }) {
    const [summary, setSummary] = useState({ pending: 0, ready: 0, delivered: 0, revenue: 0 });

    useEffect(() => {
        const fetchSummary = async () => {
            const supabase = createClient();
            const { count: pending } = await supabase.from('lab_orders').select('*', { count: 'exact', head: true }).eq('lab_org_id', orgId).in('status', ['in_production', 'quality_check']);
            const { count: ready } = await supabase.from('lab_orders').select('*', { count: 'exact', head: true }).eq('lab_org_id', orgId).eq('status', 'ready');
            const { count: delivered } = await supabase.from('lab_orders').select('*', { count: 'exact', head: true }).eq('lab_org_id', orgId).eq('status', 'delivered');
            const { data: invoices } = await supabase.from('invoices').select('total').eq('lab_org_id', orgId).eq('status', 'paid');
            const revenue = invoices?.reduce((s, i) => s + (i.total || 0), 0) || 0;
            setSummary({ pending: pending || 0, ready: ready || 0, delivered: delivered || 0, revenue });
        };
        fetchSummary();
    }, [orgId]);

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-4 px-6 pb-6">
                <div className="text-center p-4 bg-blue-500/5 rounded-xl">
                    <Clock className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">{summary.pending}</div>
                    <div className="text-xs text-muted-foreground">Pendientes</div>
                </div>
                <div className="text-center p-4 bg-emerald-500/5 rounded-xl">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-emerald-600">{summary.ready}</div>
                    <div className="text-xs text-muted-foreground">Listos</div>
                </div>
                <div className="text-center p-4 bg-purple-500/5 rounded-xl">
                    <TruckIcon className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">{summary.delivered}</div>
                    <div className="text-xs text-muted-foreground">Entregados</div>
                </div>
                <div className="text-center p-4 bg-accent/5 rounded-xl">
                    <DollarSign className="h-5 w-5 text-accent mx-auto mb-2" />
                    <div className="text-xl font-bold text-accent">${summary.revenue.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">Ingresos</div>
                </div>
            </div>
        </Card>
    );
}
