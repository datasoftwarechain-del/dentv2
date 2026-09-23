/**
 * [035_design_studio] Números del estudio de diseño.
 *
 * Funciones puras sobre filas ya traídas: nada de Supabase acá, para que
 * cada métrica se pueda testear con números a mano.
 *
 * Una decisión de fondo: **toda métrica viaja con su tamaño de muestra**.
 * Un 100% de puntualidad sobre 2 órdenes no significa lo mismo que sobre
 * 200, y una pantalla que muestra solo el porcentaje invita a decidir
 * sobre ruido. Por eso cada resultado trae su `sample`.
 *
 * Se usa MEDIANA y no promedio para los tiempos: un caso que quedó
 * olvidado tres semanas corre el promedio lo suficiente como para que el
 * número deje de describir a ningún caso real.
 */

import { getDesignService } from "./services";
import type { DesignOrderStatus } from "./status";

export interface MetricOrderRow {
  id: string;
  status: DesignOrderStatus;
  submitted_at: string | null;
  first_delivery_at: string | null;
  approved_at: string | null;
  delivered_at: string | null;
  due_at: string | null;
  revision_count: number;
  assigned_to: string | null;
  items: Array<{
    service_code: string;
    quantity: number;
    unit_price: number | null;
    unit_cost: number | null;
    is_revision_fee?: boolean;
  }>;
}

/** Una medida con su tamaño de muestra. Nunca se devuelve una sin la otra. */
export interface Measure {
  value: number;
  sample: number;
}

const NO_DATA: Measure = { value: 0, sample: 0 };

function hoursBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / 3_600_000;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round1((sorted[mid - 1] + sorted[mid]) / 2)
    : round1(sorted[mid]);
}

/**
 * Horas desde que el cliente envía hasta la PRIMERA entrega.
 *
 * Mide lo que el cliente percibe como "cuánto tardan", no el tiempo de
 * diseño: incluye la espera en la cola, que es donde se pierde el plazo
 * cuando el estudio está saturado.
 */
export function turnaroundHours(orders: MetricOrderRow[]): Measure {
  const values = orders
    .map((o) => hoursBetween(o.submitted_at, o.first_delivery_at))
    .filter((h): h is number => h !== null);
  return values.length === 0 ? NO_DATA : { value: median(values), sample: values.length };
}

/** Horas desde que el cliente aprueba hasta que se liberan los archivos. */
export function deliveryHours(orders: MetricOrderRow[]): Measure {
  const values = orders
    .map((o) => hoursBetween(o.approved_at, o.delivered_at))
    .filter((h): h is number => h !== null);
  return values.length === 0 ? NO_DATA : { value: median(values), sample: values.length };
}

/**
 * Porcentaje de primeras entregas dentro del plazo comprometido.
 *
 * Se mide contra `first_delivery_at`, no contra la entrega final: una vez
 * que la pelota pasó al cliente, el reloj del estudio se detiene. Si no,
 * un cliente que tarda tres días en aprobar arruinaría la métrica de
 * alguien que entregó a horario.
 */
export function onTimeRate(orders: MetricOrderRow[]): Measure {
  const withCommitment = orders.filter((o) => o.due_at && o.first_delivery_at);
  if (withCommitment.length === 0) return NO_DATA;

  const onTime = withCommitment.filter(
    (o) => new Date(o.first_delivery_at!).getTime() <= new Date(o.due_at!).getTime(),
  ).length;

  return {
    value: round1((onTime / withCommitment.length) * 100),
    sample: withCommitment.length,
  };
}

/**
 * Porcentaje de órdenes que hubo que devolver por falta de datos.
 *
 * Es la métrica que más plata mueve del tablero: cada punto acá son dos
 * mensajes y un día de plazo que el estudio regala. Si sube, el problema
 * suele estar en el formulario o en un cliente concreto, no en el equipo.
 *
 * `orderIdsWithNeedsInfo` sale de la bitácora: una orden que ya volvió a
 * `submitted` no conserva rastro en su estado actual.
 */
export function needsInfoRate(
  orders: MetricOrderRow[],
  orderIdsWithNeedsInfo: Set<string>,
): Measure {
  const submitted = orders.filter((o) => o.submitted_at !== null);
  if (submitted.length === 0) return NO_DATA;

  const affected = submitted.filter((o) => orderIdsWithNeedsInfo.has(o.id)).length;
  return { value: round1((affected / submitted.length) * 100), sample: submitted.length };
}

/** Revisiones pedidas por orden. Una media alta señala indicaciones flojas. */
export function revisionsPerOrder(orders: MetricOrderRow[]): Measure {
  const delivered = orders.filter((o) => o.first_delivery_at !== null);
  if (delivered.length === 0) return NO_DATA;
  const total = delivered.reduce((sum, o) => sum + (o.revision_count ?? 0), 0);
  return { value: round1(total / delivered.length), sample: delivered.length };
}

export interface ServiceBreakdown {
  serviceCode: string;
  label: string;
  orders: number;
  units: number;
  revenue: number;
  cost: number;
  margin: number;
  /** Revisiones promedio de las órdenes que incluyen este servicio. */
  avgRevisions: number;
  /** Líneas sin unit_cost: mide cuánto confiar en `margin`. */
  itemsWithoutCost: number;
}

/** Volumen y margen por servicio. Los cargos por revisión van aparte. */
export function breakdownByService(orders: MetricOrderRow[]): ServiceBreakdown[] {
  const map = new Map<string, ServiceBreakdown & { revisionSum: number }>();

  for (const order of orders) {
    const seenInOrder = new Set<string>();

    for (const item of order.items ?? []) {
      const code = item.service_code;
      const entry = map.get(code) ?? {
        serviceCode: code,
        label: getDesignService(code)?.label ?? code,
        orders: 0,
        units: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        avgRevisions: 0,
        itemsWithoutCost: 0,
        revisionSum: 0,
      };

      const qty = Number(item.quantity ?? 1);
      const unitCost = Number(item.unit_cost ?? 0);

      entry.units += qty;
      entry.revenue += Number(item.unit_price ?? 0) * qty;
      entry.cost += unitCost * qty;
      if (!(unitCost > 0)) entry.itemsWithoutCost++;

      // Una orden cuenta una sola vez por servicio, aunque traiga dos líneas.
      if (!seenInOrder.has(code)) {
        seenInOrder.add(code);
        entry.orders++;
        entry.revisionSum += order.revision_count ?? 0;
      }

      map.set(code, entry);
    }
  }

  return Array.from(map.values())
    .map(({ revisionSum, ...entry }) => ({
      ...entry,
      revenue: round2(entry.revenue),
      cost: round2(entry.cost),
      margin: round2(entry.revenue - entry.cost),
      avgRevisions: entry.orders > 0 ? round1(revisionSum / entry.orders) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface DesignerBreakdown {
  userId: string;
  orders: number;
  revenue: number;
  cost: number;
  margin: number;
  medianTurnaroundHours: number;
  avgRevisions: number;
}

/**
 * Producción por diseñador.
 *
 * Solo cuenta órdenes con `assigned_to`. Las sin asignar no se reparten
 * entre nadie: inventar un dueño para que los totales cierren haría que
 * la comparación entre diseñadores deje de significar algo.
 */
export function breakdownByDesigner(orders: MetricOrderRow[]): DesignerBreakdown[] {
  const map = new Map<string, {
    userId: string; orders: number; revenue: number; cost: number;
    turnarounds: number[]; revisionSum: number;
  }>();

  for (const order of orders) {
    if (!order.assigned_to) continue;

    const entry = map.get(order.assigned_to) ?? {
      userId: order.assigned_to,
      orders: 0, revenue: 0, cost: 0, turnarounds: [], revisionSum: 0,
    };

    entry.orders++;
    entry.revisionSum += order.revision_count ?? 0;

    for (const item of order.items ?? []) {
      const qty = Number(item.quantity ?? 1);
      entry.revenue += Number(item.unit_price ?? 0) * qty;
      entry.cost += Number(item.unit_cost ?? 0) * qty;
    }

    const hours = hoursBetween(order.submitted_at, order.first_delivery_at);
    if (hours !== null) entry.turnarounds.push(hours);

    map.set(order.assigned_to, entry);
  }

  return Array.from(map.values())
    .map((e) => ({
      userId: e.userId,
      orders: e.orders,
      revenue: round2(e.revenue),
      cost: round2(e.cost),
      margin: round2(e.revenue - e.cost),
      medianTurnaroundHours: median(e.turnarounds),
      avgRevisions: e.orders > 0 ? round1(e.revisionSum / e.orders) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface StudioTotals {
  revenue: number;
  cost: number;
  margin: number;
  /** Lo facturado en cargos por revisión: mide cuánto cuesta el ida y vuelta. */
  revisionRevenue: number;
  orders: number;
}

export function studioTotals(orders: MetricOrderRow[]): StudioTotals {
  let revenue = 0;
  let cost = 0;
  let revisionRevenue = 0;

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const qty = Number(item.quantity ?? 1);
      const line = Number(item.unit_price ?? 0) * qty;
      revenue += line;
      cost += Number(item.unit_cost ?? 0) * qty;
      if (item.is_revision_fee) revisionRevenue += line;
    }
  }

  revenue = round2(revenue);
  cost = round2(cost);

  return {
    revenue,
    cost,
    margin: round2(revenue - cost),
    revisionRevenue: round2(revisionRevenue),
    orders: orders.length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
