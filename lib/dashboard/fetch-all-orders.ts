/**
 * Todas las órdenes de una organización, para calcular KPIs.
 *
 * EL BUG QUE ESTO ARREGLA
 *   El dashboard derivaba cada indicador — total, activas, entregadas del
 *   mes, distribución por estado, el gráfico de 14 días, el ranking de
 *   clientes — de la misma lista que muestra las "recientes", y esa
 *   lista tiene .limit(200). Con 554 órdenes en producción, el total se
 *   quedó clavado en 200 durante meses y nadie pudo saber por qué: no
 *   había error, solo un número que no crecía.
 *
 * POR QUÉ PAGINA
 *   Supabase devuelve como máximo 1000 filas por request aunque no se
 *   pida límite. Sacar el .limit(200) hubiera movido el techo a 1000 —
 *   el mismo bug, más lejos. Esto recorre .range() hasta agotar.
 *
 * POR QUÉ COLUMNAS MÍNIMAS
 *   Para contar y agrupar alcanza con estado y fechas. Traer paciente,
 *   ítems y catálogo de 554 órdenes en cada carga del dashboard es
 *   pagar en cada visita algo que solo se usa para 6 filas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export interface KpiOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  /** [032] Cuándo se entregó de verdad. NULL en órdenes viejas. */
  delivered_at: string | null;
  due_date: string | null;
  dentist_org: { id: string; name: string } | { id: string; name: string }[] | null;
  lab_org: { id: string; name: string } | { id: string; name: string }[] | null;
}

export async function fetchAllOrdersForKpis(
  supabase: SupabaseClient,
  by: "lab_org_id" | "dentist_org_id",
  orgId: string,
): Promise<KpiOrder[]> {
  const all: KpiOrder[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("lab_orders")
      .select(`
        id, order_number, status, created_at, delivered_at, due_date,
        dentist_org:organizations!lab_orders_dentist_org_id_fkey(id, name),
        lab_org:organizations!lab_orders_lab_org_id_fkey(id, name)
      `)
      .eq(by, orgId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      // Que se vea. Un dashboard con ceros por un error tragado es lo que
      // convierte un bug de una tarde en uno de meses.
      console.error("[dashboard] no se pudieron traer las órdenes para KPIs:", error.message);
      break;
    }

    all.push(...((data ?? []) as unknown as KpiOrder[]));
    if (!data || data.length < PAGE) break;
  }

  return all;
}
