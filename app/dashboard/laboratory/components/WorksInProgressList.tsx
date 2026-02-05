'use client'
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { differenceInDays, isToday } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { AlertCircle, Calendar } from 'lucide-react';

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

        const { data, error } = await supabase
            .from('lab_orders')
            .update({ status: newStatus })
            .eq('id', orderId)
            .select('invoice_id, order_number')
            .single();

        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else if (data?.invoice_id && newStatus === 'ready') {
            alert(`✅ Orden ${data.order_number} completada. Factura generada automáticamente.`);
        }

        setUpdating(null);
        fetchOrders();
    };

    if (orders.length === 0) {
        return (
            <Card><div className="p-12 text-center"><p className="text-muted-foreground">No hay trabajos en progreso</p></div></Card>
        );
    }

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader><CardTitle>Trabajos en Progreso</CardTitle></CardHeader>
            <div className="px-6 pb-6 space-y-2">
                {orders.map((order) => {
                    const dueDate = new Date(order.due_date);
                    const daysUntil = differenceInDays(dueDate, new Date());
                    const isUrgent = daysUntil <= 2;
                    const isDueToday = isToday(dueDate);
                    const patient = Array.isArray(order.patient) ? order.patient[0] : order.patient;
                    const dentistOrg = Array.isArray(order.dentist_org) ? order.dentist_org[0] : order.dentist_org;
                    const items = Array.isArray(order.items) ? order.items : [order.items];
                    const workTypes = items.map((i: any) => i?.work_type).filter(Boolean).join(', ') || 'Sin especificar';

                    return (
                        <div
                            key={order.id}
                            className={cn(
                                "p-4 border-l-4 rounded-2xl ring-1 ring-border/50 hover:ring-border transition-all",
                                isUrgent ? "border-red-500 bg-red-500/5" : isDueToday ? "border-orange-500 bg-orange-500/5" : "border-blue-500 bg-blue-500/5"
                            )}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm">#{order.order_number.slice(-6)}</span>
                                        {isUrgent && (
                                            <span className="text-[10px] font-bold bg-red-500/20 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {daysUntil < 0 ? 'Vencido' : `Vence en ${daysUntil}d`}
                                            </span>
                                        )}
                                        {isDueToday && !isUrgent && (
                                            <span className="text-[10px] font-bold bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                Vence hoy
                                            </span>
                                        )}
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                            order.priority === 'urgent' ? "bg-red-100 text-red-700" :
                                                order.priority === 'high' ? "bg-orange-100 text-orange-700" :
                                                    order.priority === 'normal' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                                        )}>
                                            {order.priority?.toUpperCase() || 'NORMAL'}
                                        </span>
                                    </div>
                                    <p className="font-semibold text-sm">{workTypes}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {patient ? `${patient.first_name} ${patient.last_name}` : 'Sin paciente'} • {dentistOrg?.name || 'Sin clínica'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Vencimiento: {formatDistanceToNow(dueDate, { addSuffix: true, locale: es })}
                                    </p>
                                    {order.notes && (
                                        <p className="text-xs text-muted-foreground italic mt-1">
                                            ℹ️ {order.notes}
                                        </p>
                                    )}
                                </div>

                                <select
                                    value={order.status}
                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                    disabled={updating === order.id}
                                    className="text-xs border rounded-md px-2 py-1 bg-background font-medium min-w-[140px]"
                                >
                                    <option value="in_production">En Producción</option>
                                    <option value="quality_check">Control Calidad</option>
                                    <option value="ready">Listo</option>
                                    <option value="delivered">Entregado</option>
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
