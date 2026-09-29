"use client";

/**
 * Refresco en vivo del dashboard.
 *
 * Escucha por Supabase Realtime los cambios (INSERT/UPDATE/DELETE) en las
 * tablas de ESTA organización y vuelve a pedir los Server Components de
 * la ruta actual (router.refresh) sin recargar la página ni perder el
 * estado del cliente (búsqueda, pestaña, formularios abiertos). Así, si
 * en otra ventana se crea una orden o pasa a "entregado", el listado, el
 * Kanban, el inicio y el estado de cuenta se actualizan solos.
 *
 * Se monta UNA vez en app/dashboard/layout.tsx: un solo canal por sesión
 * que sobrevive a la navegación entre pantallas.
 *
 * Qué tablas y por qué columna depende del tipo de organización: el
 * laboratorio es lab_org_id en órdenes/facturas/libro mayor y en las
 * solicitudes web; la clínica, dentist_org_id; el estudio de diseño,
 * studio_org_id en design_orders y lab_org_id en facturas; el cliente de
 * diseño, client_org_id. Un filtro por una columna que no existe hace
 * fallar la suscripción, por eso el mapa es explícito.
 *
 * Requiere que las tablas estén en la publicación `supabase_realtime`
 * (scripts/041_realtime_dashboard.paste.sql). Si no lo están, no llega
 * ningún evento; por eso además se refresca al volver a la pestaña
 * (visibilitychange / focus), que cubre "cambié algo en otra ventana y
 * volví a esta".
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrgType = "dentist" | "lab" | "dentist_preview" | "design_studio" | "design_client";

interface Subscription {
  table: string;
  column: string;
}

const SUBSCRIPTIONS: Record<OrgType, Subscription[]> = {
  lab: [
    { table: "lab_orders", column: "lab_org_id" },
    { table: "invoices", column: "lab_org_id" },
    { table: "ledger_movements", column: "lab_org_id" },
    { table: "lab_requests", column: "lab_org_id" },
  ],
  dentist: [
    { table: "lab_orders", column: "dentist_org_id" },
    { table: "invoices", column: "dentist_org_id" },
    { table: "ledger_movements", column: "dentist_org_id" },
  ],
  design_studio: [
    { table: "design_orders", column: "studio_org_id" },
    { table: "invoices", column: "lab_org_id" },
    { table: "ledger_movements", column: "lab_org_id" },
    // [042] La bandeja de postulaciones se actualiza sola al entrar una.
    { table: "design_applications", column: "studio_org_id" },
  ],
  design_client: [
    { table: "design_orders", column: "client_org_id" },
    { table: "invoices", column: "dentist_org_id" },
  ],
  // El preview no es dueño de ninguna fila (los datos son de la clínica
  // real): solo refresco al volver a la pestaña.
  dentist_preview: [],
};

const DEBOUNCE_MS = 400;

interface LiveRefreshProps {
  orgId: string;
  orgType: OrgType;
}

export function LiveRefresh({ orgId, orgType }: LiveRefreshProps) {
  const router = useRouter();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    const subs = SUBSCRIPTIONS[orgType] ?? [];
    const supabase = createClient();
    let channel = supabase.channel(`dashboard-live-${orgId}`);
    for (const { table, column } of subs) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${column}=eq.${orgId}` },
        refresh,
      );
    }
    if (subs.length > 0) {
      channel.subscribe((_status, err) => {
        if (err) console.warn("[LiveRefresh] Realtime:", err.message);
      });
    }

    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(channel);
    };
  }, [orgId, orgType, router]);

  return null;
}
