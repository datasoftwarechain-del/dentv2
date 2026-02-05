'use client'
import { Card, CardHeader } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Package } from 'lucide-react';

export function TotalOrdersCard({ orgId }: { orgId: string }) {
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        const fetchTotal = async () => {
            const supabase = createClient();
            const { count } = await supabase
                .from('lab_orders')
                .select('*', { count: 'exact', head: true })
                .eq('lab_org_id', orgId);
            setTotal(count || 0);
        };
        fetchTotal();
    }, [orgId]);

    return (
        <Card className="border border-border/50 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <p className="text-xs font-bold uppercase text-muted-foreground/70">Órdenes Totales</p>
                <Package className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <div className="px-6 pb-6">
                <div className="text-2xl font-bold">{total !== null ? total : '...'}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Histórico acumulado</p>
            </div>
        </Card>
    );
}
