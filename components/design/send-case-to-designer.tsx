"use client";

/**
 * [042_designers] Enviar el caso por correo a uno o más diseñadores.
 *
 * Paso manual previo al bot: el moderador elige a quién mandarle el caso.
 * La lista son los aprobados de la bandeja de postulaciones, no un campo
 * de texto libre: un email tipeado a mano manda datos clínicos a donde no
 * corresponde y no hay forma de deshacerlo.
 *
 * El resultado se informa por destinatario. Si el proveedor acepta a unos
 * y rechaza a otros, se ve exactamente quién quedó afuera en vez de un
 * "listo" que esconde la mitad.
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
  const [selected, setSelected] = useState<string[]>([]);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: string[]; failed: { name: string; reason: string }[] } | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleSend() {
    setIsSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/design/orders/${orderId}/send-to-designer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ designer_ids: selected, include_files: includeFiles }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo enviar el caso");
      setResult(payload.data);
      setSelected([]);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el caso");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setResult(null); setError(null); setSelected([]); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Send className="h-4 w-4" aria-hidden="true" />
          Enviar por email a un diseñador
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar {orderNumber}</DialogTitle>
          <DialogDescription>
            El correo lleva el detalle del caso y, si lo dejás marcado, enlaces de descarga
            a los escaneos que vencen en 72 horas.
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
            {result.sent.length > 0 && (
              <p className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Enviado a {result.sent.join(", ")}.
              </p>
            )}
            {result.failed.length > 0 && (
              <div className="space-y-1">
                {result.failed.map((f) => (
                  <p key={f.name} className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {f.name}: {f.reason}
                  </p>
                ))}
              </div>
            )}
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
                  <Checkbox
                    id={`designer-${d.id}`}
                    checked={selected.includes(d.id)}
                    onCheckedChange={() => toggle(d.id)}
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
              disabled={selected.length === 0 || isSending || !emailConfigured}
              className="gap-2"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {isSending ? "Enviando…" : `Enviar a ${selected.length || ""}`.trim()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
