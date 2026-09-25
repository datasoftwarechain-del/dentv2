"use client";

/**
 * Refresco en vivo de las pantallas de facturación.
 *
 * Escucha por Supabase Realtime los cambios en órdenes, facturas y
 * movimientos del libro mayor de ESTA organización, y vuelve a pedir los
 * Server Components (router.refresh) sin recargar la página ni perder el
 * estado del cliente (búsqueda, pestaña, formularios abiertos). Así, si en
 * otra ventana una orden pasa a "entregado", el estado de cuenta se
 * actualiza solo.
 *
 * Requiere que las tablas estén en la publicación `supabase_realtime`
 * (scripts/041_realtime_billing.paste.sql). Si no lo están, no llega
 * ningún evento; por eso además se refresca al volver a la pestaña
 * (visibilitychange / focus), que cubre el caso "cambié algo en otra
 * ventana y volví a esta".
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LiveRefreshProps {
  /** Organización dueña de la pantalla. */
  orgId: string;
  /** Columna por la que filtrar: quién factura (lab) o quién recibe (clínica). */
  orgColumn: "lab_org_id" | "dentist_org_id";
}

const TABLES = ["lab_orders", "invoices", "ledger_movements"] as const;
const DEBOUNCE_MS = 400;

export function LiveRefresh({ orgId, orgColumn }: LiveRefreshProps) {
  const router = useRouter();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    const supabase = createClient();
    let channel = supabase.channel(`billing-live-${orgId}`);
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${orgColumn}=eq.${orgId}` },
        refresh,
      );
    }
    channel.subscribe((status, err) => {
      if (err) console.warn("[LiveRefresh] Realtime:", err.message);
    });

    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(channel);
    };
  }, [orgId, orgColumn, router]);

  return null;
}
