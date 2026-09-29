"use client";

/**
 * [042_designers] Bandeja de postulaciones del estudio.
 *
 * Tres pestañas por estado. Aprobar habilita a la persona como
 * destinatario del botón "Enviar por email" de cada caso, así que la
 * acción está detrás de manage_design_clients y el botón desaparece
 * (no se deshabilita en silencio) cuando no hay permiso.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DESIGN_SERVICE_CATEGORY_LABELS } from "@/lib/design/services";
import {
  APPLICATION_STATUS_LABEL,
  type DesignApplication,
  type DesignApplicationStatus,
} from "@/lib/design/applications";
import {
  Loader2, Mail, Phone, MapPin, ExternalLink, Check, X, RotateCcw, Inbox, AlertCircle,
} from "lucide-react";

const TABS: DesignApplicationStatus[] = ["pending_review", "approved", "rejected"];

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

interface Props {
  applications: DesignApplication[];
  pendingCount: number;
  status: DesignApplicationStatus;
  canReview: boolean;
}

export function DesignersInbox({ applications, pendingCount, status, canReview }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function act(id: string, action: "approve" | "reject" | "reopen", why?: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/designer-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify(action === "reject" ? { action, reason: why ?? null } : { action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar");
      setRejecting(null);
      setReason("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button
            key={t}
            asChild
            variant={t === status ? "default" : "outline"}
            size="sm"
          >
            <a href={`/dashboard/design/designers?status=${t}`}>
              {APPLICATION_STATUS_LABEL[t]}
              {t === "pending_review" && pendingCount > 0 && (
                <span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">{pendingCount}</span>
              )}
            </a>
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay postulaciones en {APPLICATION_STATUS_LABEL[status].toLowerCase()}.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {applications.map((a) => {
            const busy = busyId === a.id || isPending;
            return (
              <li key={a.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{a.full_name}</h3>
                      <Badge variant="outline" className="font-mono text-xs">{a.application_number}</Badge>
                      {a.years_experience !== null && (
                        <span className="text-xs text-muted-foreground">
                          {a.years_experience} {a.years_experience === 1 ? "año" : "años"} de experiencia
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        <a className="hover:text-primary" href={`mailto:${a.email}`}>{a.email}</a>
                      </span>
                      {a.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />{a.phone}
                        </span>
                      )}
                      {a.city && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />{a.city}
                        </span>
                      )}
                      {a.portfolio_url && (
                        <a
                          className="inline-flex items-center gap-1.5 hover:text-primary"
                          href={a.portfolio_url} target="_blank" rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Portfolio
                        </a>
                      )}
                    </div>

                    {(a.software?.length || a.specialties?.length) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(a.software ?? []).map((s) => (
                          <Badge key={`sw-${s}`} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {(a.specialties ?? []).map((s) => (
                          <Badge key={`sp-${s}`} variant="outline" className="text-xs">
                            {DESIGN_SERVICE_CATEGORY_LABELS[s as keyof typeof DESIGN_SERVICE_CATEGORY_LABELS] ?? s}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {a.notes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{a.notes}</p>
                    )}
                    {a.rejection_reason && (
                      <p className="mt-3 text-sm text-destructive">Motivo: {a.rejection_reason}</p>
                    )}
                  </div>

                  {canReview && (
                    <div className="flex shrink-0 gap-2">
                      {a.status !== "approved" && (
                        <Button size="sm" disabled={busy} onClick={() => void act(a.id, "approve")} className="gap-1.5">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Aprobar
                        </Button>
                      )}
                      {a.status !== "rejected" && (
                        <Button
                          size="sm" variant="outline" disabled={busy}
                          onClick={() => setRejecting(rejecting === a.id ? null : a.id)}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />Rechazar
                        </Button>
                      )}
                      {a.status !== "pending_review" && (
                        <Button
                          size="sm" variant="ghost" disabled={busy}
                          onClick={() => void act(a.id, "reopen")} className="gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />Reabrir
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {rejecting === a.id && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <Textarea
                      rows={2} maxLength={500} value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo del rechazo (opcional, queda guardado)"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => void act(a.id, "reject", reason)}>
                        Confirmar rechazo
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setReason(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className={cn("text-xs text-muted-foreground", canReview && "hidden")}>
        No tenés permiso para aprobar o rechazar postulaciones.
      </p>
    </div>
  );
}
