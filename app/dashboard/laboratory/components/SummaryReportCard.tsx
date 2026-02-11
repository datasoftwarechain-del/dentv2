'use client'
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, Clock, CheckCircle, TruckIcon, Calendar } from 'lucide-react';
import { getDateRange, formatNumber, type DateRangePeriod } from '@/lib/date-utils';
import { ORDER_STATUS_GROUPS } from '@/lib/order-status';
import { cn } from '@/lib/utils';

interface SummaryData {
    pending: number;
    completed: number;
    delivered: number;
    revenue: number;
}

export function SummaryReportCard({ orgId }: { orgId: string }) {
    const [period, setPeriod] = useState<DateRangePeriod>('month');
    const [summary, setSummary] = useState<SummaryData>({
        pending: 0,
        completed: 0,
        delivered: 0,
        revenue: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSummary();
    }, [orgId, period]);

    const fetchSummary = async () => {
        setLoading(true);
        const supabase = createClient();

        // Build date range
        const range = getDateRange(period);

        // Base query for orders
        let orderQuery = supabase
            .from('lab_orders')
            .select('status, created_at')
            .eq('lab_org_id', orgId);

        if (range) {
            orderQuery = orderQuery
                .gte('created_at', range.start.toISOString())
                .lte('created_at', range.end.toISOString());
        }

        const { data: orders } = await orderQuery;

        // Calculate order stats
        const pending = orders?.filter(o =>
            ORDER_STATUS_GROUPS.active.includes(o.status as any)
        ).length || 0;

        const completed = orders?.filter(o =>
            ORDER_STATUS_GROUPS.completed.includes(o.status as any)
        ).length || 0;

        const delivered = orders?.filter(o =>
            ORDER_STATUS_GROUPS.delivered.includes(o.status as any)
        ).length || 0;

        // Revenue calculation - from paid invoices
        let invoiceQuery = supabase
            .from('invoices')
            .select('total, status, paid_at')
            .eq('lab_org_id', orgId)
            .eq('status', 'paid');

        if (range) {
            invoiceQuery = invoiceQuery
                .gte('paid_at', range.start.toISOString())
                .lte('paid_at', range.end.toISOString());
        }

        const { data: invoices } = await invoiceQuery;
        const revenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;

        setSummary({ pending, completed, delivered, revenue });
        setLoading(false);
    };

    return (
        <Card className="border border-border/50 shadow-premium relative">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Resumen Operativo</CardTitle>

                {/* Period Selector */}
                <div className="flex gap-1">
                    {(['today', 'week', 'month', 'all'] as DateRangePeriod[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "text-[10px] px-2 py-1 rounded-md transition-colors font-medium",
                                period === p
                                    ? 'bg-primary text-white'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            )}
                        >
                            {p === 'today' ? 'Hoy' : p === 'week' ? 'Sem' : p === 'month' ? 'Mes' : 'Todo'}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <div className="grid grid-cols-2 gap-4 px-6 pb-6">
                <div className="text-center p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <Clock className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-amber-600">{summary.pending}</div>
                    <div className="text-xs text-muted-foreground">En Proceso</div>
                </div>

                <div className="text-center p-4 bg-secondary/5 rounded-xl border border-secondary/20">
                    <CheckCircle className="h-5 w-5 text-secondary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-secondary">{summary.completed}</div>
                    <div className="text-xs text-muted-foreground">Completados</div>
                </div>

                <div className="text-center p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
                    <TruckIcon className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">{summary.delivered}</div>
                    <div className="text-xs text-muted-foreground">Entregados</div>
                </div>

                <div className="text-center p-4 bg-accent/5 rounded-xl border border-accent/20">
                    <DollarSign className="h-5 w-5 text-accent mx-auto mb-2" />
                    <div className="text-xl font-bold text-accent">
                        ${formatNumber(summary.revenue)}
                    </div>
                    <div className="text-xs text-muted-foreground">Facturado</div>
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                    <div className="animate-spin text-2xl">⏳</div>
                </div>
            )}
        </Card>
    );
}
