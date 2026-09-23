"use client";

/**
 * [035_design_studio] Alta de un pedido de diseño.
 *
 * Sirve a los DOS lados del mostrador. El cliente elige a qué estudio le
 * pide el trabajo; el estudio elige para qué cliente lo carga — el caso
 * real de un pedido que entra por teléfono y que antes obligaba a pedirle
 * al cliente que lo cargara él.
 *
 * Dos pasos, y el orden no es negociable: la orden tiene que existir
 * antes de poder subirle archivos, porque la ruta en el bucket arranca
 * con su UUID y es sobre eso que la policy de storage da permiso.
 *
 *   Paso 1 — qué se pide: servicios, piezas/arcada, referencia del caso.
 *            Al confirmar se crea el borrador.
 *   Paso 2 — con qué se trabaja: escaneos y referencias. Al enviarlo, la
 *            compuerta del servidor decide si está completo.
 *
 * El borrador queda guardado si el cliente se va a mitad de camino.
 */

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { OdontogramSimple } from "@/components/odontogram/odontogram-simple";
import { DesignFileUploader } from "./design-file-uploader";
import {
  DESIGN_SERVICES, getDesignService, groupServicesByCategory, REQUIRED_INPUT_LABELS,
} from "@/lib/design/services";
import { validateDesignOrderForSubmit } from "@/lib/design/order-validation";
import { createDesignOrder, changeDesignOrderStatus } from "@/lib/design/client-api";
import type { DesignArch } from "@/lib/design/types";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ArrowRight, Send, AlertCircle, Info } from "lucide-react";

interface DraftItem {
  key: string;
  service_code: string;
  tooth_positions: string[];
  arch: DesignArch | null;
  quantity: number;
  notes: string;
}

interface Counterpart {
  id: string;
  name: string;
}

interface NewDesignOrderFormProps {
  /** La contraparte: estudios si sos cliente, clientes si sos el estudio. */
  counterparts: Counterpart[];
  /** 'studio' = lo carga el estudio para un cliente. 'client' = lo pide el cliente. */
  side: "studio" | "client";
}

const ARCH_OPTIONS: { value: DesignArch; label: string }[] = [
  { value: "upper", label: "Superior" },
  { value: "lower", label: "Inferior" },
  { value: "both", label: "Ambas" },
];

/**
 * Crea una línea vacía.
 *
 * La key se arma con useId() + un contador en vez de Date.now()/random:
 * esas dos dan un valor distinto en el servidor y en el cliente, y React
 * aborta la hidratación cuando los id de los <label htmlFor> no coinciden
 * con los de sus inputs. El formulario quedaba sin etiquetas asociadas.
 */
function makeItem(prefix: string, n: number): DraftItem {
  return {
    key: `${prefix}-${n}`,
    service_code: "",
    tooth_positions: [],
    arch: null,
    quantity: 1,
    notes: "",
  };
}

export function NewDesignOrderForm({ counterparts, side }: NewDesignOrderFormProps) {
  const router = useRouter();
  const isStudioSide = side === "studio";

  // Prefijo estable entre servidor y cliente.
  const idPrefix = useId();
  const nextKey = useRef(0);
  const emptyItem = () => makeItem(idPrefix, nextKey.current++);

  const [counterpartId, setCounterpartId] = useState(counterparts[0]?.id ?? "");
  const [patientRef, setPatientRef] = useState("");
  const [caseNotes, setCaseNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [items, setItems] = useState<DraftItem[]>(() => [makeItem(idPrefix, nextKey.current++)]);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [uploadedKinds, setUploadedKinds] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step: 1 | 2 = orderId ? 2 : 1;

  const patch = (key: string, changes: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));

  // La misma compuerta que aplica el servidor, para avisar antes de pedirla.
  const check = validateDesignOrderForSubmit(
    items.map((i) => ({
      service_code: i.service_code,
      tooth_positions: i.tooth_positions,
      arch: i.arch,
      quantity: i.quantity,
    })),
    uploadedKinds.map((kind) => ({ kind: kind as any })),
  );

  // En el paso 1 todavía no hay archivos: ese error no corresponde mostrarlo.
  const step1Errors = check.errors.filter((e) => !e.includes("escaneo intraoral"));

  async function handleCreateDraft() {
    if (!counterpartId) {
      toast.error(isStudioSide ? "Elegí el cliente." : "Elegí el estudio de diseño.");
      return;
    }
    if (step1Errors.length > 0) {
      toast.error(step1Errors[0]);
      return;
    }

    setIsSaving(true);
    try {
      const order = await createDesignOrder({
        ...(isStudioSide
          ? { client_org_id: counterpartId }
          : { studio_org_id: counterpartId }),
        patient_ref: patientRef.trim() || null,
        case_notes: caseNotes.trim() || null,
        priority,
        items: items.map((i) => ({
          service_code: i.service_code,
          tooth_positions: i.tooth_positions.length > 0 ? i.tooth_positions : null,
          arch: i.arch,
          quantity: i.quantity,
          notes: i.notes.trim() || null,
        })),
      });

      setOrderId(order.id);
      setOrderNumber(order.order_number);
      toast.success(`Borrador ${order.order_number} creado`, {
        description: "Ahora subí los escaneos del caso.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la orden");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (!orderId) return;

    setIsSubmitting(true);
    try {
      await changeDesignOrderStatus(orderId, "submitted");
      toast.success(isStudioSide ? `${orderNumber} ingresada` : `${orderNumber} enviada al estudio`);
      router.push(`/dashboard/design/${orderId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la orden");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (counterparts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500" aria-hidden="true" />
          <p className="font-medium text-slate-700">
            {isStudioSide
              ? "Todavía no tenés clientes habilitados"
              : "No tenés ningún estudio de diseño habilitado"}
          </p>
          <p className="max-w-md text-sm text-slate-500">
            {isStudioSide
              ? "Para cargar una orden necesitás al menos un cliente. Andá a Clientes y habilitá el primero."
              : "Para pedir diseños CAD/CAM, el estudio tiene que darte de alta como cliente. Pedile que te habilite y volvé a entrar."}
          </p>
          {isStudioSide && (
            <Button asChild className="mt-2">
              <a href="/dashboard/design/clients">Ir a Clientes</a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Paso 1 ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>1 · Qué necesitás</CardTitle>
              <CardDescription>Elegí el servicio y marcá las piezas o la arcada.</CardDescription>
            </div>
            {orderNumber && <Badge variant="outline">{orderNumber}</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* El estudio SIEMPRE elige cliente, aunque tenga uno solo:
              cargar una orden a nombre de otro sin verlo en pantalla es
              como se factura al cliente equivocado. */}
          {(isStudioSide || counterparts.length > 1) && (
            <div className="space-y-1.5">
              <Label htmlFor="counterpart">
                {isStudioSide ? "Cliente" : "Estudio de diseño"}
              </Label>
              <Select value={counterpartId} onValueChange={setCounterpartId}>
                <SelectTrigger id="counterpart" disabled={step === 2}>
                  <SelectValue placeholder={isStudioSide ? "Elegí el cliente" : "Elegí un estudio"} />
                </SelectTrigger>
                <SelectContent>
                  {counterparts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="patient-ref">Referencia del caso</Label>
              <Input
                id="patient-ref"
                value={patientRef}
                onChange={(e) => setPatientRef(e.target.value)}
                placeholder="Iniciales o número interno"
                disabled={step === 2}
                maxLength={120}
              />
              <p className="text-xs text-slate-500">
                Con las iniciales alcanza. No hace falta el nombre completo del paciente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioridad</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as "normal" | "urgent")}
              >
                <SelectTrigger id="priority" disabled={step === 2}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ─── Ítems ─────────────────────────────────────── */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const service = getDesignService(item.service_code);

              return (
                <div key={item.key} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`service-${item.key}`}>Tipo de trabajo</Label>
                      <Select
                        value={item.service_code}
                        onValueChange={(v) =>
                          // Cambiar de servicio limpia piezas y arcada: lo que
                          // valía para una corona no vale para una férula.
                          patch(item.key, { service_code: v, tooth_positions: [], arch: null })
                        }
                      >
                        <SelectTrigger id={`service-${item.key}`} disabled={step === 2}>
                          <SelectValue placeholder="Elegí el servicio de diseño" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupServicesByCategory().map((group) => (
                            <SelectGroup key={group.category}>
                              <SelectLabel>{group.label}</SelectLabel>
                              {group.services.map((s) => (
                                <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {service && (
                        <p className="text-xs text-slate-500">{service.description}</p>
                      )}
                    </div>

                    <div className="w-20 space-y-1.5">
                      <Label htmlFor={`qty-${item.key}`}>Cant.</Label>
                      <Input
                        id={`qty-${item.key}`}
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity}
                        onChange={(e) =>
                          patch(item.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        disabled={step === 2}
                      />
                    </div>

                    {items.length > 1 && step === 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-7"
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                        aria-label={`Quitar servicio ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    )}
                  </div>

                  {service?.requiresArch && (
                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor={`arch-${item.key}`}>Arcada</Label>
                      <Select
                        value={item.arch ?? ""}
                        onValueChange={(v) => patch(item.key, { arch: v as DesignArch })}
                      >
                        <SelectTrigger id={`arch-${item.key}`} className="sm:w-60" disabled={step === 2}>
                          <SelectValue placeholder="Elegí la arcada" />
                        </SelectTrigger>
                        <SelectContent>
                          {ARCH_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {service?.requiresTeeth && (
                    <div className="mt-4 space-y-2">
                      <Label>Piezas dentarias</Label>
                      <OdontogramSimple
                        value={item.tooth_positions.map(Number).filter(Number.isFinite)}
                        onChange={(teeth) =>
                          patch(item.key, { tooth_positions: teeth.map(String) })
                        }
                        disabled={step === 2}
                      />
                      {item.tooth_positions.length > 0 && (
                        <p className="text-xs text-slate-600">
                          Seleccionadas: {item.tooth_positions.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {service && (
                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor={`notes-${item.key}`}>Indicaciones (opcional)</Label>
                      <Textarea
                        id={`notes-${item.key}`}
                        rows={2}
                        value={item.notes}
                        onChange={(e) => patch(item.key, { notes: e.target.value })}
                        placeholder="Material, color, espesor de cemento, contactos…"
                        disabled={step === 2}
                        maxLength={1000}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {step === 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar otro servicio
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-notes">Notas del caso (opcional)</Label>
            <Textarea
              id="case-notes"
              rows={3}
              value={caseNotes}
              onChange={(e) => setCaseNotes(e.target.value)}
              placeholder="Cualquier cosa que el diseñador tenga que saber antes de empezar."
              disabled={step === 2}
              maxLength={4000}
            />
          </div>

          {step === 1 && (
            <>
              {step1Errors.length > 0 && (
                <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3">
                  {step1Errors.map((error) => (
                    <li key={error} className="flex gap-2 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {error}
                    </li>
                  ))}
                </ul>
              )}

              <Button
                type="button"
                onClick={handleCreateDraft}
                disabled={isSaving || step1Errors.length > 0}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Continuar y subir archivos
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Paso 2 ─────────────────────────────────────────── */}
      {step === 2 && orderId && (
        <Card>
          <CardHeader>
            <CardTitle>2 · Archivos del caso</CardTitle>
            <CardDescription>
              {isStudioSide
                ? "Subí los escaneos que te mandó el cliente. El borrador ya está guardado."
                : "Subí los escaneos. El borrador ya está guardado: si cerrás esta página, lo retomás desde el listado."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Checklist de lo que el caso normalmente necesita. */}
            {(() => {
              const needed = new Set<string>();
              items.forEach((i) =>
                getDesignService(i.service_code)?.requiredInputs.forEach((r) => needed.add(r)),
              );
              if (needed.size === 0) return null;
              return (
                <div className="flex gap-2 rounded-md border border-[#b0dde0] bg-[#e0f4f6]/40 p-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#09919b]" aria-hidden="true" />
                  <div className="text-sm text-[#044c64]">
                    <p className="font-medium">Para este caso hacen falta:</p>
                    <p className="mt-0.5 text-[#0d687d]">
                      {Array.from(needed)
                        .map((k) => REQUIRED_INPUT_LABELS[k as keyof typeof REQUIRED_INPUT_LABELS])
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-[#0d687d]">
                      Si el escáner exporta todo en un .zip, con ese archivo alcanza.
                    </p>
                  </div>
                </div>
              );
            })()}

            <DesignFileUploader
              orderId={orderId}
              kind="input_scan"
              label="Escaneos intraorales"
              onUploaded={() => setUploadedKinds((prev) => [...prev, "input_scan"])}
            />

            <DesignFileUploader
              orderId={orderId}
              kind="input_reference"
              label="Fotos, radiografías o indicaciones (opcional)"
              onUploaded={() => setUploadedKinds((prev) => [...prev, "input_reference"])}
            />

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !check.canSubmit}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isStudioSide ? "Ingresar a la cola" : "Enviar al estudio"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/design/${orderId}`)}
              >
                Guardar y seguir después
              </Button>

              {!check.canSubmit && (
                <p className="text-sm text-slate-500">
                  Subí al menos un escaneo para poder enviarla.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
