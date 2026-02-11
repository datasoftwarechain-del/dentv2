'use client'
import { Card, CardHeader } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Package } from 'lucide-react';
import { getDateRange, type DateRangePeriod } from '@/lib/date-utils';
import { ORDER_STATUS_GROUPS } from '@/lib/order-status';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'active' | 'completed' | 'delivered';

interface OrderStats {
    total: number;
    active: number;
    completed: number;
    delivered: number;
}

export function TotalOrdersCard({ orgId }: { orgId: string }) {
    const [period, setPeriod] = useState<DateRangePeriod>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [stats, setStats] = useState<OrderStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, [orgId, period]);

    const fetchStats = async () => {
        setLoading(true);
        const supabase = createClient();

        // Build base query
        let query = supabase
            .from('lab_orders')
            .select('status')
            .eq('lab_org_id', orgId);

        // Apply time filter
        const range = getDateRange(period);
        if (range) {
            query = query
                .gte('created_at', range.start.toISOString())
                .lte('created_at', range.end.toISOString());
        }

        const { data: orders } = await query;

        // Calculate stats
        const stats: OrderStats = {
            total: orders?.length || 0,
            active: orders?.filter(o => ORDER_STATUS_GROUPS.active.includes(o.status as any)).length || 0,
            completed: orders?.filter(o => ORDER_STATUS_GROUPS.completed.includes(o.status as any)).length || 0,
            delivered: orders?.filter(o => ORDER_STATUS_GROUPS.delivered.includes(o.status as any)).length || 0
        };

        setStats(stats);
        setLoading(false);
    };

    const getDisplayValue = () => {
        if (!stats) return '...';
        switch (statusFilter) {
            case 'active': return stats.active;
            case 'completed': return stats.completed;
            case 'delivered': return stats.delivered;
            default: return stats.total;
        }
    };

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground/70">
                        Órdenes Totales
                    </p>
                    <Package className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>

            <div className="px-6 pb-4">
                <div className="text-3xl font-bold">{loading ? '...' : getDisplayValue()}</div>

                {/* Period Filter */}
                <div className="flex gap-1 mt-3">
                    {(['all', 'today', 'week', 'month'] as DateRangePeriod[]).map(p => (
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
                            {p === 'all' ? 'Todo' : p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
                        </button>
                    ))}
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                        className={cn(
                            "text-center p-2 rounded-lg transition-all",
                            statusFilter === 'active'
                                ? 'bg-primary/5 ring-2 ring-primary'
                                : 'bg-muted/30 hover:bg-muted/50'
                        )}
                    >
                        <div className="text-lg font-bold text-primary">{stats?.active || 0}</div>
                        <div className="text-[9px] text-muted-foreground">Activos</div>
                    </button>

                    <button
                        onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
                        className={cn(
                            "text-center p-2 rounded-lg transition-all",
                            statusFilter === 'completed'
                                ? 'bg-secondary/5 ring-2 ring-secondary'
                                : 'bg-muted/30 hover:bg-muted/50'
                        )}
                    >
                        <div className="text-lg font-bold text-secondary">{stats?.completed || 0}</div>
                        <div className="text-[9px] text-muted-foreground">Listos</div>
                    </button>

                    <button
                        onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
                        className={cn(
                            "text-center p-2 rounded-lg transition-all",
                            statusFilter === 'delivered'
                                ? 'bg-purple-50 ring-2 ring-purple-600'
                                : 'bg-muted/30 hover:bg-muted/50'
                        )}
                    >
                        <div className="text-lg font-bold text-purple-600">{stats?.delivered || 0}</div>
                        <div className="text-[9px] text-muted-foreground">Entregados</div>
                    </button>
                </div>
            </div>
        </Card>
    );
}
