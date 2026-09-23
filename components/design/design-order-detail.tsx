"use client";

/**
 * [035_design_studio] Detalle de una orden de diseño.
 *
 * Es donde ocurre el negocio: el estudio sube el diseño, el cliente lo
 * mira y aprueba o pide cambios. Los botones NO están cableados a mano:
 * salen de `nextStatuses(status, side)`, así que la pantalla nunca ofrece
 * una acción que el servidor va a rechazar, y agregar un estado a la
 * máquina lo hace aparecer acá solo.
 *
 * Los estados que van para atrás (faltan datos, cambios, cancelar) piden
 * un motivo antes de ejecutarse — el servidor también lo exige, pero
 * pedirlo acá evita el viaje de ida y vuelta.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DesignFileUploader } from "./design-file-uploader";
import { DesignPaymentPanel } from "./design-payment-panel";
import {
  DESIGN_STATUS_BADGE_CLASSES, getDesignStatusLabel, nextStatuses, isRevisionBillable,
  type DesignOrderStatus,
} from "@/lib/design/status";
import { getDesignServiceLabel, includedRevisionsForOrder } from "@/lib/design/services";
import { formatBytes } from "@/lib/design/files";
import { formatMoney } from "@/lib/money";
import {
  listDesignFiles, changeDesignOrderStatus, downloadDesignFile,
} from "@/lib/design/client-api";
import type { DesignOrderDetail as DetailType, DesignFileKind } from "@/lib/design/types";
import { toast } from "sonner";
import {
  Download, Lock, Loader2, FileText, MessageSquare, CheckCircle2, RotateCcw, Ban, Clock,
  Wallet,
} from "lucide-react";

type FileRow = DetailType["files"][number] & { download_url: string | null; locked: boolean };

interface OrderInvoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string | null;
}

interface DesignOrderDetailProps {
  order: DetailType & {
    side: "client" | "studio";
    payment_mode: "account" | "prepaid";
    invoice?: OrderInvoice | null;
    /** false = colaborador del estudio sin view_prices: no ve importes. */
    can_see_amount?: boolean;
  };
}

/** Etiqueta del botón para cada destino. Lo que lee el usuario, no el estado técnico. */
const ACTION_LABELS: Partial<Record<DesignOrderStatus, string>> = {
  submitted: "Enviar al estudio",
  needs_info: "Pedir datos que faltan",
  assigned: "Tomar el caso",
  in_design: "Empezar el diseño",
  internal_review: "Pasar a control interno",
  client_review: "Enviar al cliente para aprobar",
  revision_requested: "Pedir cambios",
  approved: "Aprobar el diseño",
  delivered: "Marcar como entregada",
  cancelled: "Cancelar la orden",
};

/**
 * La etiqueta del botón depende de DÓNDE está la orden, no solo de a
 * dónde va. "Enviar al estudio" es correcto saliendo de un borrador y no
 * significa nada saliendo de "esperando pago", donde el mismo destino
 * quiere decir "el dinero llegó, largá el trabajo".
 */
function actionLabel(from: DesignOrderStatus, to: DesignOrderStatus): string {
  if (from === "awaiting_payment" && to === "submitted") {
    return "Confirmar pago y encolar";
  }
  return ACTION_LABELS[to] ?? to;
}

/** Destinos que exigen un motivo escrito. */
const NEEDS_REASON: DesignOrderStatus[] = ["needs_info", "revision_requested", "cancelled"];

const FILE_GROUPS: { kind: DesignFileKind; title: string }[] = [
  { kind: "output_design", title: "Diseño terminado" },
  { kind: "output_preview", title: "Previsualización" },
  { kind: "input_scan", title: "Escaneos del caso" },
  { kind: "input_reference", title: "Referencias" },
  { kind: "annotation", title: "Marcas y anotaciones" },
];

export function DesignOrderDetail({ order }: DesignOrderDetailProps) {
  const router = useRouter();
  const { side } = order;
  const isStudio = side === "studio";

  const [files, setFiles] = useState<FileRow[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [pendingAction, setPendingAction] = useState<DesignOrderStatus | null>(null);
  const [reason, setReason] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      setFiles(await listDesignFiles(order.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los archivos");
    } finally {
      setIsLoadingFiles(false);
    }
  }, [order.id]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  const actions = nextStatuses(order.status, side);

  /**
   * Orden recién creada y todavía sin un solo escaneo. Es el estado en el
   * que llega alguien que acaba de pedir un diseño desde la web, y en ese
   * momento hay una sola cosa que importa: subir el archivo. Si el
   * recuadro queda como tercera sección, debajo del encabezado y de los
   * servicios, el cliente se va sin subir nada y la orden queda en
   * borrador para siempre — que es exactamente lo que pasó.
   */
  const needsFirstUpload =
    !isStudio &&
    order.status === "draft" &&
    !isLoadingFiles &&
    files.filter((f) => f.kind === "input_scan").length === 0;

  async function runTransition(to: DesignOrderStatus, message?: string) {
    setIsWorking(true);
    try {
      await changeDesignOrderStatus(order.id, to, { message });
      toast.success(actionLabel(order.status, to));
      setPendingAction(null);
      setReason("");
      router.refresh();
      void refreshFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado");
    } finally {
      setIsWorking(false);
    }
  }

  function handleAction(to: DesignOrderStatus) {
    if (NEEDS_REASON.includes(to)) {
      setPendingAction(to);
      return;
    }
    void runTransition(to);
  }

  // Aviso honesto antes de pedir cambios: si ya se gastaron las incluidas,
  // la próxima vuelta se cobra. Mejor que enterarse en la factura.
  const includedRevisions = includedRevisionsForOrder(
    order.items.map((i) => i.service_code),
  );
  const nextRevisionBillable = isRevisionBillable(order.revision_count, includedRevisions);

  return (
    <div className="space-y-6">
      {/* ─── Encabezado ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {order.order_number}
                <Badge variant="outline" className={cn(DESIGN_STATUS_BADGE_CLASSES[order.status])}>
                  {getDesignStatusLabel(order.status, side)}
                </Badge>
                {order.priority === "urgent" && (
                  <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                    Urgente
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isStudio
                  ? order.client_org?.name ?? "Cliente"
                  : order.studio_org?.name ?? "Estudio"}
                {order.patient_ref ? ` · ${order.patient_ref}` : ""}
                {order.due_at
                  ? ` · Entrega ${new Date(order.due_at).toLocaleDateString("es-AR")}`
                  : ""}
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {actions.map((to) => (
                <Button
                  key={to}
                  size="sm"
                  variant={to === "cancelled" ? "outline" : "default"}
                  onClick={() => handleAction(to)}
                  disabled={isWorking}
                >
                  {to === "approved" && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                  {to === "revision_requested" && <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                  {to === "cancelled" && <Ban className="mr-1.5 h-3.5 w-3.5" />}
                  {actionLabel(order.status, to)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        {(order.case_notes || order.revision_count > 0) && (
          <CardContent className="space-y-3 border-t pt-4">
            {order.case_notes && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Indicaciones del cliente
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{order.case_notes}</p>
              </div>
            )}
            {order.revision_count > 0 && (
              <p className="text-sm text-slate-500">
                {order.revision_count} {order.revision_count === 1 ? "revisión pedida" : "revisiones pedidas"}
                {" · "}
                {includedRevisions} sin cargo incluidas
                {nextRevisionBillable && (
                  <span className="text-orange-700"> · la próxima se factura aparte</span>
                )}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* ─── Pendiente de pago ────────────────────────────── */}
      {order.status === "awaiting_payment" && (
        <DesignPaymentPanel
          orderId={order.id}
          isStudio={isStudio}
          canSeeAmount={order.can_see_amount ?? true}
        />
      )}

      {/* ─── Próximo paso: subir el escaneo ───────────────── */}
      {needsFirstUpload && (
        <Card className="border-[#43eada] bg-[#e0f4f6]/40">
          <CardHeader>
            <CardTitle className="text-base text-[#044c64]">
              Subí el escaneo para que empecemos
            </CardTitle>
            <CardDescription className="text-[#0d687d]">
              Tu pedido está guardado, pero todavía no podemos diseñarlo sin los
              archivos. Aceptamos .stl, .ply, .obj, .dcm y el .zip que exporta tu
              escáner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DesignFileUploader
              orderId={order.id}
              kind="input_scan"
              label="Escaneos intraorales"
              onUploaded={refreshFiles}
            />
            <DesignFileUploader
              orderId={order.id}
              kind="input_reference"
              label="Fotos, radiografías o indicaciones (opcional)"
              onUploaded={refreshFiles}
            />
            <p className="text-xs text-[#0d687d]">
              Cuando termines, tocá <strong>Enviar al estudio</strong> arriba.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Servicios ────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Servicios pedidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {getDesignServiceLabel(item.service_code)}
                    {item.is_revision_fee && (
                      <Badge variant="outline" className="ml-2 border-orange-200 bg-orange-50 text-orange-700">
                        Revisión extra
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.tooth_positions?.length
                      ? `Piezas ${item.tooth_positions.join(", ")}`
                      : item.arch
                        ? { upper: "Arcada superior", lower: "Arcada inferior", both: "Ambas arcadas" }[item.arch]
                        : "—"}
                    {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                  </p>
                  {item.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ─── Archivos ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivos</CardTitle>
          {!isStudio && order.payment_mode === "prepaid" && (
            <CardDescription>
              El diseño terminado se habilita cuando la factura esté paga.
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          {isLoadingFiles ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando archivos…
            </div>
          ) : (
            FILE_GROUPS.map((group) => {
              const groupFiles = files.filter((f) => f.kind === group.kind);
              if (groupFiles.length === 0) return null;

              return (
                <div key={group.kind}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {group.title}
                  </p>
                  <ul className="space-y-1.5">
                    {groupFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-700">{file.file_name}</p>
                          <p className="text-xs text-slate-400">
                            v{file.version}
                            {file.file_size ? ` · ${formatBytes(file.file_size)}` : ""}
                          </p>
                        </div>

                        {file.locked ? (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                            {order.payment_mode === "prepaid" ? "Pendiente de pago" : "Sin liberar"}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!file.download_url}
                            onClick={() =>
                              file.download_url && downloadDesignFile(file.download_url, file.file_name)
                            }
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Descargar
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}

          {/* El estudio sube el entregable mientras la orden esté viva. */}
          {isStudio && !["delivered", "cancelled"].includes(order.status) && (
            <div className="space-y-4 border-t pt-4">
              <DesignFileUploader
                orderId={order.id}
                kind="output_design"
                label="Subir el diseño terminado (STL)"
                hint="Se libera para descarga recién cuando el cliente apruebe."
                onUploaded={refreshFiles}
              />
              <DesignFileUploader
                orderId={order.id}
                kind="output_preview"
                label="Subir una previsualización"
                hint="Render o captura. El cliente la ve enseguida, para poder aprobar."
                onUploaded={refreshFiles}
              />
            </div>
          )}

          {/* El cliente completa lo que falta cuando la orden vuelve. Se
              omite si ya está el bloque destacado de arriba: dos zonas de
              subida idénticas en la misma pantalla es una invitación a
              subir el mismo archivo dos veces. */}
          {!isStudio && !needsFirstUpload
            && ["draft", "needs_info"].includes(order.status) && (
            <div className="border-t pt-4">
              <DesignFileUploader
                orderId={order.id}
                kind="input_scan"
                label={
                  order.status === "needs_info"
                    ? "Subir los escaneos que faltan"
                    : "Subir más escaneos"
                }
                onUploaded={refreshFiles}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Bitácora ─────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {order.events.map((event) => (
              <li key={event.id} className="flex gap-3 px-6 py-3">
                <div className="mt-0.5">
                  {event.type === "message" || event.type === "revision_request" ? (
                    <MessageSquare className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  ) : (
                    <Clock className="h-4 w-4 text-slate-300" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">
                    {event.to_status
                      ? getDesignStatusLabel(event.to_status, side)
                      : event.type === "file_upload"
                        ? "Archivo subido"
                        : "Mensaje"}
                    <span className="ml-2 text-xs text-slate-400">
                      {event.actor_side === "studio" ? "estudio" : event.actor_side === "client" ? "cliente" : "sistema"}
                    </span>
                  </p>
                  {event.message && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-500">{event.message}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(event.created_at).toLocaleString("es-AR")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ─── Motivo obligatorio ───────────────────────────── */}
      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction ? actionLabel(order.status, pendingAction) : ""}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === "needs_info" &&
                "Decile al cliente exactamente qué falta o qué está mal en los archivos."}
              {pendingAction === "revision_requested" &&
                (nextRevisionBillable
                  ? "Ya usaste las revisiones incluidas: esta vuelta se factura aparte. Detallá qué hay que cambiar."
                  : "Detallá qué hay que cambiar en el diseño.")}
              {pendingAction === "cancelled" && "Dejá asentado por qué se cancela."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Sin esto, del otro lado no se sabe qué corregir."
              maxLength={4000}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={isWorking}>
              Volver
            </Button>
            <Button
              onClick={() => pendingAction && runTransition(pendingAction, reason.trim())}
              disabled={isWorking || reason.trim().length === 0}
            >
              {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
