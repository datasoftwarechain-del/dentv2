"use client";

/**
 * [040_lab_requests] Bandeja del laboratorio.
 *
 * Lista por estado + detalle en diálogo con las dos acciones del
 * negocio: "Convertir en orden" (elige clínica existente o crea una,
 * confirma tipo de trabajo y precio) y "Rechazar". La conversión es
 * idempotente del lado servidor: un doble clic recibe 409, no dos
 * órdenes.
 *
 * Los montos solo se renderizan si canViewPrices: el servidor ya no los
 * manda, y acá tampoco se pide el campo de precio.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { WORK_TYPE_LABELS } from "@/lib/work-types";
import { getLabProduct, LAB_WORK_TYPES } from "@/lib/lab-requests/products";
import {
  LAB_REQUEST_FILE_STATUS_LABELS, LAB_REQUEST_STATUS_LABELS, type LabRequestStatus,
} from "@/lib/lab-requests/status";
import type { LabRequest } from "@/lib/lab-requests/types";
import { convertLabRequest, getLabRequest, rejectLabRequest } from "@/lib/lab-requests/client-api";
import {
  AlertTriangle, ArrowUpRight, Building2, Download, FileCheck2, FileX2, Inbox, Loader2, Zap,
} from "lucide-react";

interface Clinic { id: string; name: string; email: string | null }

interface Props {
  requests: LabRequest[];
  pendingCount: number;
  status: LabRequestStatus;
  clinics: Clinic[];
  catalogPrices: Record<string, number>;
  canConvert: boolean;
  canReject: boolean;
  canViewPrices: boolean;
}

const TABS: { value: LabRequestStatus; label: string }[] = [
  { value: "pending_review", label: "Pendientes" },
  { value: "converted", label: "Convertidas" },
  { value: "rejected", label: "Rechazadas" },
];

const NEW_CLINIC = "__new__";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

export function LabRequestsInbox({
  requests, pendingCount, status, clinics, catalogPrices, canConvert, canReject, canViewPrices,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<LabRequest | null>(null);

  return (
    <div className="space-y-6">
      {/* Tabs por estado: la URL manda, así se puede compartir. */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/dashboard/lab-requests?status=${t.value}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              status === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {t.label}
            {t.value === "pending_review" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{pendingCount}</span>
            )}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === "pending_review" ? "No hay solicitudes pendientes" : "Nada por acá"}
          description="Las solicitudes que lleguen desde las cards de fresado e impresión de la web aparecen en esta bandeja."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Solicitud</th>
                <th className="px-4 py-2.5">Profesional</th>
                <th className="px-4 py-2.5">Producto</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Archivo</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Fecha</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => {
                const product = getLabProduct(r.product_key);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium">{r.request_number}</div>
                      <div className="flex gap-1 pt-1">
                        {r.urgency === "urgent" && (
                          <Badge variant="destructive" className="gap-1"><Zap className="h-3 w-3" aria-hidden />Urgente</Badge>
                        )}
                        {r.status !== "pending_review" && (
                          <Badge variant="secondary">{LAB_REQUEST_STATUS_LABELS[r.status]}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.professional_name}</div>
                      <div className="text-xs text-muted-foreground">{r.clinic_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{product?.label ?? r.product_key}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.quantity} {product?.unit ?? "u"}{r.quantity > 1 ? "s" : ""}
                        {r.shade ? ` · ${r.shade}` : ""}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <FileBadge status={r.file_status} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Ver</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <RequestDialog
          request={selected}
          clinics={clinics}
          catalogPrice={selected.catalog_item_id ? catalogPrices[selected.catalog_item_id] : undefined}
          canConvert={canConvert}
          canReject={canReject}
          canViewPrices={canViewPrices}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function FileBadge({ status }: { status: LabRequest["file_status"] }) {
  if (status === "uploaded") {
    return <Badge variant="secondary" className="gap-1 text-emerald-700"><FileCheck2 className="h-3 w-3" aria-hidden />{LAB_REQUEST_FILE_STATUS_LABELS.uploaded}</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="destructive" className="gap-1"><FileX2 className="h-3 w-3" aria-hidden />{LAB_REQUEST_FILE_STATUS_LABELS.pending}</Badge>;
  }
  return <span className="text-xs text-muted-foreground">{LAB_REQUEST_FILE_STATUS_LABELS.none}</span>;
}

// ─── Detalle + acciones ────────────────────────────────────────

function RequestDialog({
  request: r, clinics, catalogPrice, canConvert, canReject, canViewPrices, onClose, onChanged,
}: {
  request: LabRequest;
  clinics: Clinic[];
  catalogPrice: number | undefined;
  canConvert: boolean;
  canReject: boolean;
  canViewPrices: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const product = getLabProduct(r.product_key);
  const isOpen = r.status === "pending_review";

  const [mode, setMode] = useState<"view" | "convert" | "reject">("view");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Conversión. Clínica sugerida: la que coincide por email, si existe.
  const suggested = clinics.find((c) => c.email && c.email.toLowerCase() === r.email.toLowerCase());
  const [clinicId, setClinicId] = useState<string>(suggested?.id ?? NEW_CLINIC);
  const [newClinicName, setNewClinicName] = useState(r.clinic_name);
  const [workType, setWorkType] = useState<string>(product?.defaultWorkType ?? "otro");
  const [unitPrice, setUnitPrice] = useState<string>(catalogPrice !== undefined ? String(catalogPrice) : "");
  const [dueDate, setDueDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  async function download() {
    setDownloading(true);
    try {
      const { data } = await getLabRequest(r.id);
      if (!data.download_url) throw new Error("El archivo no está disponible.");
      window.open(data.download_url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setDownloading(false);
    }
  }

  async function convert() {
    setBusy(true);
    try {
      const isNew = clinicId === NEW_CLINIC;
      const price = canViewPrices && unitPrice.trim() !== "" ? Number(unitPrice) : undefined;
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        throw new Error("Precio inválido.");
      }
      const { data, warning } = await convertLabRequest(r.id, {
        dentist_org_id: isNew ? null : clinicId,
        new_clinic: isNew ? { name: newClinicName.trim(), email: r.email, phone: r.phone, address: r.address, city: r.city } : null,
        work_type: workType,
        unit_price: price,
        due_date: dueDate || null,
        internal_notes: internalNotes.trim() || null,
      });
      toast.success(data.already ? "Ya estaba convertida" : `Orden ${data.order_number ?? ""} creada`, {
        description: warning ?? undefined,
        action: { label: "Abrir orden", onClick: () => window.location.assign(`/dashboard/orders/${data.lab_order_id}`) },
      });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo convertir");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await rejectLabRequest(r.id, rejectReason.trim() || null);
      toast.success("Solicitud rechazada");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo rechazar");
    } finally {
      setBusy(false);
    }
  }

  const delivery = [r.address, r.city, r.department].filter(Boolean).join(", ");

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{r.request_number}</span>
            <span className="font-normal text-muted-foreground">· {product?.label ?? r.product_key}</span>
            {r.urgency === "urgent" && <Badge variant="destructive">Urgente</Badge>}
            {!isOpen && <Badge variant="secondary">{LAB_REQUEST_STATUS_LABELS[r.status]}</Badge>}
          </DialogTitle>
          <DialogDescription>Recibida el {fmtDate(r.created_at)} desde la web.</DialogDescription>
        </DialogHeader>

        {/* ─── Datos ─────────────────────────────────────── */}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Profesional">{r.professional_name}</Field>
          <Field label="Clínica">{r.clinic_name}</Field>
          <Field label="Email"><a className="underline" href={`mailto:${r.email}`}>{r.email}</a></Field>
          <Field label="Teléfono">{r.phone ?? "—"}</Field>
          <Field label="Entrega">{delivery || "—"}</Field>
          <Field label="Ref. paciente">{r.patient_ref ?? "—"}</Field>
          <Field label="Cantidad">{r.quantity} {product?.unit ?? "u"}{r.quantity > 1 ? "s" : ""}</Field>
          <Field label="Piezas / color">
            {[r.tooth_positions?.join(", "), r.shade].filter(Boolean).join(" · ") || "—"}
          </Field>
          <Field label="Material">{r.material ?? "—"}</Field>
          <Field label="Ítem de catálogo">
            {r.catalog_name ?? "—"}
            {canViewPrices && catalogPrice !== undefined && (
              <span className="ml-1 text-muted-foreground">({formatMoney(catalogPrice, "ARS")})</span>
            )}
          </Field>
          {r.existing_case_ref && <Field label="Caso existente">{r.existing_case_ref}</Field>}
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Archivo</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <FileBadge status={r.file_status} />
              {r.file_name && <span className="text-muted-foreground">{r.file_name}</span>}
              {r.file_status === "uploaded" && (
                <Button size="sm" variant="outline" onClick={download} disabled={downloading}>
                  {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                  Descargar
                </Button>
              )}
              {r.file_status === "pending" && (
                <span className="flex items-center gap-1 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Pedíselo al profesional por email.
                </span>
              )}
            </dd>
          </div>
          {r.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Indicaciones</dt>
              <dd className="mt-1 whitespace-pre-line rounded-lg bg-muted/40 p-3">{r.notes}</dd>
            </div>
          )}
          {r.status === "converted" && r.lab_order_id && (
            <div className="sm:col-span-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/orders/${r.lab_order_id}`}>
                  Abrir la orden <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          )}
          {r.status === "rejected" && (
            <Field label="Motivo del rechazo">{r.rejection_reason ?? "—"}</Field>
          )}
        </dl>

        {/* ─── Convertir ─────────────────────────────────── */}
        {isOpen && mode === "convert" && (
          <div className="space-y-4 rounded-xl border p-4">
            <h3 className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" aria-hidden /> Convertir en orden</h3>

            <div className="space-y-1.5">
              <Label htmlFor="lr-clinic">Clínica</Label>
              <Select value={clinicId} onValueChange={setClinicId}>
                <SelectTrigger id="lr-clinic">
                  <SelectValue>
                    {clinicId === NEW_CLINIC ? `+ Nueva clínica: ${r.clinic_name}` : clinics.find((c) => c.id === clinicId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_CLINIC}>+ Nueva clínica: {r.clinic_name}</SelectItem>
                  {clinics.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{suggested?.id === c.id ? " · mismo email" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clinicId === NEW_CLINIC && (
                <Input
                  aria-label="Nombre de la clínica nueva" value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)} className="mt-2"
                />
              )}
            </div>

            <div className={cn("grid gap-4", canViewPrices ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <div className="space-y-1.5">
                <Label htmlFor="lr-wt">Tipo de trabajo</Label>
                <Select value={workType} onValueChange={setWorkType}>
                  <SelectTrigger id="lr-wt"><SelectValue>{WORK_TYPE_LABELS[workType] ?? workType}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {LAB_WORK_TYPES.map((wt) => (
                      <SelectItem key={wt} value={wt}>{WORK_TYPE_LABELS[wt] ?? wt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canViewPrices && (
                <div className="space-y-1.5">
                  <Label htmlFor="lr-price">Precio unitario</Label>
                  <Input
                    id="lr-price" type="number" min={0} step="0.01" inputMode="decimal"
                    value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0 es válido"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="lr-due">Fecha de entrega</Label>
                <Input id="lr-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lr-int">Notas internas <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea id="lr-int" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>Volver</Button>
              <Button onClick={convert} disabled={busy || (clinicId === NEW_CLINIC && newClinicName.trim().length < 2)}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Crear orden
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Rechazar ──────────────────────────────────── */}
        {isOpen && mode === "reject" && (
          <div className="space-y-3 rounded-xl border border-destructive/30 p-4">
            <h3 className="font-medium">Rechazar solicitud</h3>
            <div className="space-y-1.5">
              <Label htmlFor="lr-reason">Motivo <span className="text-muted-foreground">(opcional, queda en la solicitud)</span></Label>
              <Textarea id="lr-reason" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>Volver</Button>
              <Button variant="destructive" onClick={reject} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Rechazar
              </Button>
            </DialogFooter>
          </div>
        )}

        {isOpen && mode === "view" && (
          <DialogFooter className="gap-2">
            {canReject && <Button variant="outline" onClick={() => setMode("reject")}>Rechazar</Button>}
            {canConvert && <Button onClick={() => setMode("convert")}>Convertir en orden</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
