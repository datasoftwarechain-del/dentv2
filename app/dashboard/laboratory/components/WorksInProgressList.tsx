'use client'
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { differenceInDays, differenceInHours } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { AlertCircle, Calendar, Clock } from 'lucide-react';
import { getUrgencyLevel } from '@/lib/date-utils';
import { toast } from 'sonner';

export function WorksInProgressList({ orgId }: { orgId: string }) {
    const [orders, setOrders] = useState<any[]>([]);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
    }, [orgId]);

    const fetchOrders = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('lab_orders')
            .select(`
        *,
        patient:patients(first_name, last_name),
        dentist_org:organizations!lab_orders_dentist_org_id_fkey(name),
        items:lab_order_items(work_type)
      `)
            .eq('lab_org_id', orgId)
            .in('status', ['in_production', 'quality_check'])
            .order('priority', { ascending: false })
            .order('due_date', { ascending: true });

        setOrders(data || []);
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setUpdating(orderId);
        const supabase = createClient();

        // Optimistic UI update
        setOrders(prev =>
            prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
        );

        try {
            const { data, error } = await supabase
                .from('lab_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', orderId)
                .select('invoice_id, order_number, status')
                .single();

            if (error) throw error;

            // Success feedback with context
            if (newStatus === 'ready' && data.invoice_id) {
                toast.success(
                    `✅ Orden ${data.order_number} marcada como lista`,
                    { description: 'Factura generada automáticamente' }
                );
            } else if (newStatus === 'delivered') {
                toast.success(`🚚 Orden ${data.order_number} entregada`);
            } else {
                toast.success(`Estado actualizado a ${newStatus}`);
            }

            // Refresh to get accurate data
            await fetchOrders();

        } catch (error: any) {
            // Rollback optimistic update
            await fetchOrders();
            toast.error('Error al actualizar estado', {
                description: error.message
            });
        } finally {
            setUpdating(null);
        }
    };

    // Sort orders by urgency and priority
    const sortedOrders = [...orders].sort((a, b) => {
        const urgencyRank = { overdue: 0, critical: 1, urgent: 2, soon: 3, normal: 4 };
        const urgencyA = getUrgencyLevel(new Date(a.due_date));
        const urgencyB = getUrgencyLevel(new Date(b.due_date));

        // First by urgency
        if (urgencyRank[urgencyA] !== urgencyRank[urgencyB]) {
            return urgencyRank[urgencyA] - urgencyRank[urgencyB];
        }

        // Then by priority
        const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (priorityRank[a.priority as keyof typeof priorityRank] || 2) -
            (priorityRank[b.priority as keyof typeof priorityRank] || 2);
    });

    if (orders.length === 0) {
        return (
            <Card className="border border-border/50 shadow-premium">
                <div className="p-12 text-center">
                    <p className="text-muted-foreground">No hay trabajos en progreso</p>
                </div>
            </Card>
        );
    }

    // Urgency styling configuration
    const urgencyStyles = {
        overdue: {
            border: 'border-red-600',
            bg: 'bg-red-600/10',
            badge: 'bg-red-600 text-white',
            icon: '🚨',
            label: 'VENCIDO'
        },
        critical: {
            border: 'border-red-500',
            bg: 'bg-red-500/10',
            badge: 'bg-red-500/20 text-red-700',
            icon: '⚠️',
            label: 'CRÍTICO (24h)'
        },
        urgent: {
            border: 'border-orange-500',
            bg: 'bg-orange-500/10',
            badge: 'bg-orange-500/20 text-orange-700',
            icon: '🔥',
            label: 'URGENTE (48h)'
        },
        soon: {
            border: 'border-yellow-500',
            bg: 'bg-yellow-500/5',
            badge: 'bg-yellow-500/20 text-yellow-700',
            icon: '⏰',
            label: 'PRÓXIMO'
        },
        normal: {
            border: 'border-blue-500',
            bg: 'bg-blue-500/5',
            badge: 'bg-blue-500/10 text-blue-700',
            icon: '📋',
            label: 'NORMAL'
        }
    };

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Trabajos en Progreso</span>
                    <span className="text-sm font-normal text-muted-foreground">
                        {sortedOrders.length} {sortedOrders.length === 1 ? 'orden' : 'órdenes'}
                    </span>
                </CardTitle>
            </CardHeader>
            <div className="px-6 pb-6 space-y-3">
                {sortedOrders.map((order) => {
                    const dueDate = new Date(order.due_date);
                    const urgency = getUrgencyLevel(dueDate);
                    const styles = urgencyStyles[urgency];
                    const patient = Array.isArray(order.patient) ? order.patient[0] : order.patient;
                    const dentistOrg = Array.isArray(order.dentist_org) ? order.dentist_org[0] : order.dentist_org;
                    const items = Array.isArray(order.items) ? order.items : [order.items];
                    const workTypes = items.map((i: any) => i?.work_type).filter(Boolean).join(', ') || 'Sin especificar';

                    return (
                        <div
                            key={order.id}
                            className={cn(
                                "relative p-4 border-l-4 rounded-2xl ring-1 transition-all hover:ring-2 hover:shadow-lg",
                                styles.border,
                                styles.bg
                            )}
                        >
                            {/* Urgency Badge - Top Right */}
                            <div className="absolute top-2 right-2">
                                <span className={cn(
                                    "text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1",
                                    styles.badge
                                )}>
                                    <span>{styles.icon}</span>
                                    {styles.label}
                                </span>
                            </div>

                            <div className="flex justify-between items-start gap-4 pr-28">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm">#{order.order_number.slice(-6)}</span>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                            order.priority === 'urgent' ? "bg-red-100 text-red-700" :
                                                order.priority === 'high' ? "bg-orange-100 text-orange-700" :
                                                    order.priority === 'normal' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                                        )}>
                                            PRIORIDAD: {order.priority?.toUpperCase() || 'NORMAL'}
                                        </span>
                                    </div>
                                    <p className="font-semibold text-sm">{workTypes}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {patient ? `${patient.first_name} ${patient.last_name}` : 'Sin paciente'} • {dentistOrg?.name || 'Sin clínica'}
                                    </p>
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                            Vence: {formatDistanceToNow(dueDate, { addSuffix: true, locale: es })}
                                        </span>
                                    </div>
                                    {order.notes && (
                                        <p className="text-xs text-muted-foreground italic mt-2 bg-white/50 p-2 rounded">
                                            ℹ️ {order.notes}
                                        </p>
                                    )}
                                </div>

                                <select
                                    value={order.status}
                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                    disabled={updating === order.id}
                                    className="text-xs border rounded-md px-2 py-1 bg-background font-medium min-w-[140px] disabled:opacity-50"
                                >
                                    <option value="in_production">En Producción</option>
                                    <option value="quality_check">Control Calidad</option>
                                    <option value="ready">✅ Listo</option>
                                    <option value="delivered">🚚 Entregado</option>
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
