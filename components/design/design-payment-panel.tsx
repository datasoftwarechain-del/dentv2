"use client";

/**
 * [payments] Panel de pago de una orden.
 *
 * Aparece cuando la orden está en 'awaiting_payment'. Es la caja: acá
 * se decide si el trabajo arranca o no.
 *
 * Dos reglas de la pantalla:
 *
 *   1. El importe viene del servidor, nunca se calcula acá. Un total
 *      recalculado en el navegador puede diferir del de la factura y
 *      dejar al cliente pagando un número que no es el que debe.
 *   2. Si no hay ninguna pasarela configurada, lo dice y explica cómo
 *      seguir. Un botón de pago que no lleva a ningún lado es peor que
 *      no tener botón.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";
import { Wallet, Loader2, ExternalLink, AlertCircle } from "lucide-react";

interface ProviderInfo {
  id: string;
  label: string;
  hint: string;
}

interface CheckoutInfo {
  /** null = el servidor lo ocultó (colaborador sin view_prices). */
  amount: number | null;
  currency: string;
  invoice_number: string;
  providers: ProviderInfo[];
}

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Cuántas veces refrescar esperando el webhook, a 4 s cada una. */
const CONFIRM_POLLS = 15;

export function DesignPaymentPanel({
  orderId, isStudio, canSeeAmount = true,
}: { orderId: string; isStudio: boolean; canSeeAmount?: boolean }) {
  const router = useRouter();
  const returned = useSearchParams().get("pago"); // 'ok' | 'cancelado' | null
  const [polls, setPolls] = useState(0);

  // El cliente vuelve del checkout ANTES de que llegue el webhook. Si la
  // pantalla mostrara "pendiente de pago" como si nada, pensaría que el
  // pago no entró y lo intentaría de nuevo. Se le dice que se está
  // confirmando y se refresca hasta que la orden salga de este estado
  // (momento en que este panel desaparece solo).
  useEffect(() => {
    if (returned !== "ok" || polls >= CONFIRM_POLLS) return;
    const t = setTimeout(() => { router.refresh(); setPolls((n) => n + 1); }, 4000);
    return () => clearTimeout(t);
  }, [returned, polls, router]);

  const confirming = returned === "ok" && polls < CONFIRM_POLLS;

  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/design/orders/${orderId}/checkout`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo cargar el pago");
      setInfo(payload.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  async function pay(providerId: string) {
    setRedirecting(providerId);
    try {
      const response = await fetch(`/api/design/orders/${orderId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ provider: providerId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo iniciar el pago");

      window.location.href = payload.data.checkoutUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al iniciar el pago");
      setRedirecting(null);
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          {isStudio ? "Esperando el pago del cliente" : "Pendiente de pago"}
        </CardTitle>
        <CardDescription className="text-amber-800">
          {isStudio
            ? "El trabajo no entra a la cola hasta que el pago se acredite."
            : "Tu pedido está reservado. Empezamos a diseñar apenas se acredite el pago."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {confirming && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Pago recibido, confirmando con la pasarela… Esta pantalla se actualiza sola.
          </div>
        )}
        {returned === "ok" && !confirming && (
          <p className="text-sm text-amber-900">
            La confirmación está tardando más de lo normal. Si ya pagaste, no vuelvas
            a hacerlo: se acredita en cuanto la pasarela avise.
          </p>
        )}
        {returned === "cancelado" && (
          <p className="text-sm text-amber-900">
            El pago se canceló. Podés volver a intentarlo cuando quieras.
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : error ? (
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : info ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
              {/* Un colaborador del estudio sin view_prices ve que hay una
                  factura pendiente, pero no de cuánto. */}
              {canSeeAmount && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-700">Total</p>
                  <p className="text-3xl font-semibold text-amber-900">
                    {formatMoney(info.amount ?? 0, info.currency === "USD" ? "USD" : "ARS")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-700">Factura</p>
                <p className="font-medium text-amber-900">{info.invoice_number}</p>
              </div>
            </div>

            {isStudio ? (
              <p className="text-sm text-amber-800">
                El cliente puede pagar desde su panel. Si te pagó por fuera, registrá
                el pago en Facturación y la orden entra a la cola sola.
              </p>
            ) : info.providers.length > 0 ? (
              <div className="space-y-2">
                {info.providers.map((p) => (
                  <Button
                    key={p.id}
                    onClick={() => pay(p.id)}
                    disabled={redirecting !== null}
                    className="w-full justify-between sm:w-auto sm:justify-start"
                  >
                    {redirecting === p.id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <ExternalLink className="mr-2 h-4 w-4" />}
                    {p.label}
                  </Button>
                ))}
                <p className="text-xs text-amber-700">
                  {info.providers.map((p) => p.hint).join(" · ")}
                </p>
              </div>
            ) : (
              /* Sin pasarela configurada: se cobra por fuera. Decirlo es
                 mejor que mostrar un botón que no lleva a ningún lado. */
              <p className="text-sm text-amber-800">
                Te vamos a contactar para coordinar el pago. Apenas se acredite,
                empezamos con el diseño.
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
