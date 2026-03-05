'use client'
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { AlertCircle, Clock, Flame, Timer, CheckCircle2, User, Building2, Package } from 'lucide-react';
import { getUrgencyLevel } from '@/lib/date-utils';
import { formatWorkType } from '@/lib/work-types';
import { toast } from 'sonner';

export function WorksInProgressList({ orgId }: { orgId: string }) {
    const [orders, setOrders] = useState<any[]>([]);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => { fetchOrders(); }, [orgId]);

    const fetchOrders = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('lab_orders')
            .select(`*, patient:patients(first_name, last_name), dentist_org:organizations!lab_orders_dentist_org_id_fkey(name), items:lab_order_items(work_type, catalog_item:price_catalog(name))`)
            .eq('lab_org_id', orgId)
            .in('status', ['in_production', 'quality_check'])
            .order('priority', { ascending: false })
            .order('due_date', { ascending: true });
        setOrders(data || []);
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setUpdating(orderId);
        const supabase = createClient();
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        try {
            const { data, error } = await supabase
                .from('lab_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', orderId)
                .select('invoice_id, order_number, status')
                .single();
            if (error) throw error;
            if (newStatus === 'ready' && data.invoice_id) {
                toast.success(`Orden ${data.order_number} marcada como lista`, { description: 'Factura generada automáticamente' });
            } else if (newStatus === 'delivered') {
                toast.success(`Orden ${data.order_number} entregada`);
            } else {
                toast.success(`Estado actualizado`);
            }
            await fetchOrders();
        } catch (error: any) {
            await fetchOrders();
            toast.error('Error al actualizar estado', { description: error.message });
        } finally {
            setUpdating(null);
        }
    };

    const sortedOrders = [...orders].sort((a, b) => {
        const urgencyRank = { overdue: 0, critical: 1, urgent: 2, soon: 3, normal: 4 };
        const urgencyA = getUrgencyLevel(new Date(a.due_date));
        const urgencyB = getUrgencyLevel(new Date(b.due_date));
        if (urgencyRank[urgencyA] !== urgencyRank[urgencyB]) return urgencyRank[urgencyA] - urgencyRank[urgencyB];
        const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (priorityRank[a.priority as keyof typeof priorityRank] || 2) - (priorityRank[b.priority as keyof typeof priorityRank] || 2);
    });

    if (orders.length === 0) {
        return (
            <div className="rounded-2xl border border-[#d2f2f3] bg-white p-12 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0fafb] border border-[#d2f2f3]">
                    <CheckCircle2 className="h-6 w-6 text-[#09919b]" />
                </div>
                <p className="text-sm font-semibold text-[#044c64]">Todo al día</p>
                <p className="text-xs text-muted-foreground mt-1">No hay trabajos en progreso</p>
            </div>
        );
    }

    // Urgency config
    const urgencyConfig = {
        overdue:  { label: 'Vencido',  Icon: AlertCircle, badge: 'bg-destructive text-white',           glow: '#ef444420', bar: 'from-destructive to-destructive/60' },
        critical: { label: 'Crítico',  Icon: AlertCircle, badge: 'bg-destructive/15 text-destructive',  glow: '#ef444410', bar: 'from-destructive/70 to-destructive/30' },
        urgent:   { label: 'Urgente',  Icon: Flame,        badge: 'bg-amber-100 text-amber-700',         glow: '#f59e0b15', bar: 'from-amber-500 to-amber-400/60' },
        soon:     { label: 'Próximo',  Icon: Timer,        badge: 'bg-[#09919b]/10 text-[#09919b]',      glow: '#09919b10', bar: 'from-[#09919b] to-[#09919b]/40' },
        normal:   { label: 'Normal',   Icon: Clock,        badge: 'bg-[#044c64]/8 text-[#044c64]',       glow: '#044c6408', bar: 'from-[#044c64]/40 to-[#09919b]/20' },
    };

    const priorityLabel: Record<string, string> = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baja' };
    const priorityBadge: Record<string, string> = {
        urgent: 'bg-destructive/10 text-destructive',
        high:   'bg-amber-100 text-amber-700',
        normal: 'bg-[#09919b]/[0.10] text-[#09919b]',
        low:    'bg-muted text-muted-foreground',
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-[#d2f2f3] bg-white shadow-sm">
            {/* Glow orb top-right */}
            <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl opacity-20"
                style={{ background: 'radial-gradient(circle, #09919b 0%, transparent 70%)' }} />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-[#d2f2f3]/60">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#b0dde0] bg-gradient-to-br from-[#f0fafb] to-white shadow-inner">
                        <Package className="h-4 w-4 text-[#09919b]" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-[#044c64] leading-none">Trabajos en Progreso</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">órdenes activas en producción</p>
                    </div>
                </div>
                <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-[#044c64] text-white text-[10px] font-black">
                    {sortedOrders.length}
                </span>
            </div>

            {/* Order cards */}
            <div className="divide-y divide-[#d2f2f3]/40">
                {sortedOrders.map((order) => {
                    const dueDate = new Date(order.due_date);
                    const urgency = getUrgencyLevel(dueDate);
                    const cfg = urgencyConfig[urgency];
                    const UrgencyIcon = cfg.Icon;
                    const patient = Array.isArray(order.patient) ? order.patient[0] : order.patient;
                    const dentistOrg = Array.isArray(order.dentist_org) ? order.dentist_org[0] : order.dentist_org;
                    const items = Array.isArray(order.items) ? order.items : [order.items];
                    const firstItem = items.find((i: any) => i?.work_type || i?.catalog_item);
                    const catalogName = Array.isArray(firstItem?.catalog_item)
                        ? firstItem.catalog_item[0]?.name
                        : firstItem?.catalog_item?.name;
                    const workLabel = catalogName || formatWorkType(firstItem?.work_type) || 'Sin especificar';
                    const priority = order.priority || 'normal';

                    return (
                        <div
                            key={order.id}
                            className="relative flex gap-0 overflow-hidden transition-all hover:bg-[#f8fdfd]"
                        >
                            {/* Left colored bar — the urgency "stripe" */}
                            <div className={cn("w-1 shrink-0 bg-gradient-to-b self-stretch", cfg.bar)} />

                            {/* Subtle glow behind the card */}
                            <div
                                className="pointer-events-none absolute inset-0"
                                style={{ background: `radial-gradient(ellipse at left center, ${cfg.glow}, transparent 60%)` }}
                            />

                            {/* Content */}
                            <div className="relative flex-1 flex items-start justify-between gap-4 px-4 py-4">
                                {/* Left info */}
                                <div className="flex-1 min-w-0">
                                    {/* Row 1: order + priority */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-black text-sm text-[#044c64] tracking-wide">{order.order_number}</span>
                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", priorityBadge[priority] ?? priorityBadge.normal)}>
                                            {priorityLabel[priority] ?? 'Normal'}
                                        </span>
                                    </div>

                                    {/* Row 2: work type — large, prominent */}
                                    <p className="text-[15px] font-bold text-foreground leading-snug mb-2">{workLabel}</p>

                                    {/* Row 3: patient + org */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mb-2">
                                        {patient && (
                                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <User className="h-3 w-3 text-[#09919b]" />
                                                {patient.first_name} {patient.last_name}
                                            </span>
                                        )}
                                        {dentistOrg && (
                                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Building2 className="h-3 w-3 text-[#09919b]" />
                                                {dentistOrg.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Row 4: due date */}
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Clock className="h-3 w-3 text-[#09919b] shrink-0" />
                                        Vence {formatDistanceToNow(dueDate, { addSuffix: true, locale: es })}
                                    </div>

                                    {/* Notes */}
                                    {order.notes && (
                                        <p className="mt-2 text-[11px] text-muted-foreground italic border-l-2 border-[#09919b]/30 pl-2">
                                            {order.notes}
                                        </p>
                                    )}
                                </div>

                                {/* Right: urgency badge + status select */}
                                <div className="flex flex-col items-end gap-2.5 shrink-0 pt-0.5">
                                    {/* Urgency badge */}
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border border-current/10",
                                        cfg.badge
                                    )}>
                                        <UrgencyIcon className="h-3.5 w-3.5 shrink-0" />
                                        {cfg.label}
                                    </span>

                                    {/* Status select */}
                                    <select
                                        value={order.status}
                                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                        disabled={updating === order.id}
                                        className="text-[12px] font-semibold border border-[#b0dde0] rounded-xl px-3 py-1.5 bg-[#f0fafb] text-[#044c64] min-w-[152px] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#09919b]/20 focus:border-[#09919b] transition-colors cursor-pointer appearance-none text-center"
                                    >
                                        <option value="in_production">▸ En Producción</option>
                                        <option value="quality_check">▸ Control de Calidad</option>
                                        <option value="ready">▸ Listo para entrega</option>
                                        <option value="delivered">▸ Entregado</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
