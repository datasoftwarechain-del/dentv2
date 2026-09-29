"use client";

/**
 * [043] Despachar el caso a un diseñador.
 *
 * Paso manual previo al bot: el moderador elige a quién mandarle el caso.
 * La lista son los aprobados de la bandeja de postulaciones, no un campo
 * de texto libre: un email tipeado a mano manda datos clínicos a donde no
 * corresponde y no hay forma de deshacerlo.
 *
 * **Uno solo.** La selección es única porque un caso no puede estar
 * despachado a dos personas a la vez: mandarlo a tres significa que dos
 * van a trabajar gratis. La base lo garantiza con un índice único parcial;
 * acá se refleja en la interfaz para que el límite se entienda antes de
 * chocarlo.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Send, AlertCircle, CheckCircle2 } from "lucide-react";

export interface DesignerOption {
  id: string;
  full_name: string;
  email: string;
}

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

interface Props {
  orderId: string;
  orderNumber: string;
  designers: DesignerOption[];
  /** false = no hay RESEND_API_KEY/EMAIL_FROM en el servidor. */
  emailConfigured: boolean;
}

export function SendCaseToDesigner({ orderId, orderNumber, designers, emailConfigured }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: string } | null>(null);

  async function handleSend() {
    setIsSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/design/orders/${orderId}/send-to-designer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ designer_id: selected, include_files: includeFiles }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo despachar el caso");
      setResult(payload.data);
      setSelected(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo despachar el caso");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setResult(null); setError(null); setSelected(null); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Send className="h-4 w-4" aria-hidden="true" />
          Despachar a un diseñador
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Despachar {orderNumber}</DialogTitle>
          <DialogDescription>
            Un caso va a un solo diseñador. El correo lleva el detalle, un enlace propio para
            aceptar y subir el diseño, y si lo dejás marcado, los escaneos.
          </DialogDescription>
        </DialogHeader>

        {!emailConfigured && (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            El envío de correo no está configurado en el servidor. Faltan RESEND_API_KEY y EMAIL_FROM.
          </p>
        )}

        {result ? (
          <div className="space-y-3 py-2">
            <p className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Despachado a {result.sent}. Recibió un enlace propio para aceptar el caso y subir el
              diseño terminado.
            </p>
          </div>
        ) : designers.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No hay diseñadores aprobados todavía. Aprobá postulaciones desde la sección
            Diseñadores y volvé acá.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {designers.map((d) => (
                <li key={d.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <input
                    type="radio"
                    name="designer"
                    id={`designer-${d.id}`}
                    className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={selected === d.id}
                    onChange={() => setSelected(d.id)}
                  />
                  <Label htmlFor={`designer-${d.id}`} className="cursor-pointer font-normal leading-tight">
                    <span className="block font-medium">{d.full_name}</span>
                    <span className="block text-xs text-muted-foreground">{d.email}</span>
                  </Label>
                </li>
              ))}
            </ul>

            <div className="flex items-start gap-3">
              <Checkbox
                id="include-files"
                checked={includeFiles}
                onCheckedChange={(v) => setIncludeFiles(v === true)}
              />
              <Label htmlFor="include-files" className="cursor-pointer font-normal leading-relaxed">
                Adjuntar enlaces a los escaneos y referencias del cliente
              </Label>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          ) : (
            <Button
              onClick={() => void handleSend()}
              disabled={!selected || isSending || !emailConfigured}
              className="gap-2"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {isSending ? "Despachando…" : "Despachar el caso"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
