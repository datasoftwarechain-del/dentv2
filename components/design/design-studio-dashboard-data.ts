/**
 * [035_design_studio] Datos del dashboard del estudio.
 *
 * Aparte de la pantalla porque es la consulta más cara del módulo y
 * conviene poder leerla, medirla y cambiarla sin abrir un componente de
 * 300 líneas de JSX.
 *
 * Todas las consultas van en paralelo: son independientes entre sí y
 * encadenarlas sumaría medio segundo a la primera pantalla que ve el
 * equipo cada mañana.
 */

import { createClient } from "@/lib/supabase/server";
import { DESIGN_STATUS_AWAITING_CLIENT } from "@/lib/design/status";

/** Estados que significan "el estudio todavía tiene que hacer algo". */
const EN_DISENO = ["assigned", "in_design", "internal_review", "revision_requested"];

export interface StudioDashboardData {
  counts: {
    porAsignar: number;
    enDiseno: number;
    esperandoCliente: number;
    vencidas: number;
    clientesActivos: number;
    sinPrecio: number;
    sinCompletar: number;
    esperandoPago: number;
  };
  facturacion: { mes: number; pendiente: number };
  recientes: any[];
}

export async function getStudioDashboardData(studioOrgId: string): Promise<StudioDashboardData> {
  const supabase = await createClient();

  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  const [
    porAsignar,
    enDiseno,
    esperandoCliente,
    vencidas,
    sinCompletar,
    esperandoPago,
    clientesActivos,
    sinPrecio,
    { data: facturasDelMes },
    { data: facturasPendientes },
    { data: recientes },
  ] = await Promise.all([
    countOrders(supabase, studioOrgId, (q) => q.eq("status", "submitted")),
    countOrders(supabase, studioOrgId, (q) => q.in("status", EN_DISENO)),
    countOrders(supabase, studioOrgId, (q) => q.in("status", DESIGN_STATUS_AWAITING_CLIENT)),
    // Vencida = pasó el plazo y sigue viva. Una entregada tarde ya no
    // pide acción: ensuciaría el número que sí la pide.
    countOrders(supabase, studioOrgId, (q) =>
      q.lt("due_at", new Date().toISOString())
       .not("status", "in", '("delivered","cancelled","draft")')),

    // Pedidos que entraron pero nunca se completaron: casi siempre son
    // del formulario público, donde el cliente cargó el caso y no llegó
    // a subir los escaneos. No entran a la cola porque no hay nada que
    // diseñar todavía, pero son ventas a medio cerrar: el estudio tiene
    // que poder verlos para llamar y destrabarlos.
    countOrders(supabase, studioOrgId, (q) => q.eq("status", "draft")),

    // Trabajo vendido pero no cobrado. No es trabajo del estudio ni
    // descuido del cliente: es plata en la puerta.
    countOrders(supabase, studioOrgId, (q) => q.eq("status", "awaiting_payment")),

    supabase
      .from("design_studio_clients")
      .select("id", { count: "exact", head: true })
      .eq("studio_org_id", studioOrgId)
      .eq("status", "active")
      .then((r) => r.count ?? 0),

    supabase
      .from("price_catalog")
      .select("id", { count: "exact", head: true })
      .eq("org_id", studioOrgId)
      .not("design_service_code", "is", null)
      .lte("base_price", 0)
      .then((r) => r.count ?? 0),

    supabase
      .from("invoices")
      .select("total")
      .eq("lab_org_id", studioOrgId)
      .not("design_order_id", "is", null)
      .is("invoice_voided_at", null)
      .gte("created_at", inicioDeMes.toISOString()),

    supabase
      .from("invoices")
      .select("total")
      .eq("lab_org_id", studioOrgId)
      .not("design_order_id", "is", null)
      .is("invoice_voided_at", null)
      .eq("status", "pending"),

    supabase
      .from("design_orders")
      .select(`
        id, order_number, status, priority, patient_ref, due_at,
        client_org:client_org_id(name),
        items:design_order_items(service_code)
      `)
      .eq("studio_org_id", studioOrgId)
      .neq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const sumar = (rows: { total: number }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);

  return {
    counts: {
      porAsignar,
      enDiseno,
      esperandoCliente,
      vencidas,
      clientesActivos,
      sinPrecio,
      sinCompletar,
      esperandoPago,
    },
    facturacion: {
      mes: sumar(facturasDelMes),
      pendiente: sumar(facturasPendientes),
    },
    recientes: recientes ?? [],
  };
}

/** Cuenta órdenes del estudio con un filtro extra. Devuelve 0 ante error. */
function countOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studioOrgId: string,
  filtro: (q: any) => any,
): Promise<number> {
  const base = supabase
    .from("design_orders")
    .select("id", { count: "exact", head: true })
    .eq("studio_org_id", studioOrgId);

  return filtro(base).then((r: any) => r.count ?? 0);
}
