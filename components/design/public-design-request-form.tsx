"use client";

/**
 * [design-intake] Formulario público de solicitud de diseño.
 *
 * Es la primera pantalla que ve alguien que no tiene cuenta. Dos reglas
 * que lo diferencian del formulario interno:
 *
 *   1. NO parece un registro. El visitante elige el trabajo y deja su
 *      email; la cuenta se crea sola por detrás. Pedirle que se registre
 *      antes de saber si le servimos es perder la mitad de las visitas.
 *   2. Los archivos NO se suben acá. Se suben después, ya adentro, porque
 *      la ruta en el bucket necesita el UUID de la orden. Se le avisa
 *      antes para que no llegue con el escaneo a mano y se frustre.
 */

import { useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getDesignService, groupServicesByCategory, REQUIRED_INPUT_LABELS,
} from "@/lib/design/services";
import type { DesignArch } from "@/lib/design/types";
import { Loader2, AlertCircle, ArrowRight, Info, Trash2, Plus } from "lucide-react";

interface DraftItem {
  key: string;
  service_code: string;
  tooth_positions: string;
  arch: DesignArch | null;
  quantity: number;
  notes: string;
}

/**
 * Crea una línea vacía.
 *
 * Key determinista (useId + contador). Con Date.now()/random el servidor
 * y el cliente generaban id distintos y React abortaba la hidratación,
 * dejando los <label> sin asociar a sus campos.
 */
function makeItem(prefix: string, n: number): DraftItem {
  return {
    key: `${prefix}-${n}`,
    service_code: "",
    tooth_positions: "",
    arch: null,
    quantity: 1,
    notes: "",
  };
}

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export function PublicDesignRequestForm() {
  const idPrefix = useId();
  const nextKey = useRef(0);
  const emptyItem = () => makeItem(idPrefix, nextKey.current++);

  // La card de la landing llega con ?servicio=<code>. Se preselecciona
  // SOLO si el código existe en el catálogo: una URL manipulada o un
  // código viejo no puede dejar el formulario en un estado inválido.
  const preselected = useSearchParams().get("servicio");
  const initialCode = preselected && getDesignService(preselected) ? preselected : "";

  const [items, setItems] = useState<DraftItem[]>(() => [
    { ...makeItem(idPrefix, nextKey.current++), service_code: initialCode },
  ]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [caseNotes, setCaseNotes] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);

  const patch = (key: string, changes: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));

  const problems: string[] = [];
  items.forEach((item, index) => {
    const service = getDesignService(item.service_code);
    if (!service) {
      problems.push(`Servicio ${index + 1}: elegí el tipo de trabajo.`);
      return;
    }
    if (service.requiresTeeth && item.tooth_positions.trim() === "") {
      problems.push(`${service.label}: indicá las piezas dentarias.`);
    }
    if (service.requiresArch && !item.arch) {
      problems.push(`${service.label}: indicá la arcada.`);
    }
  });
  if (fullName.trim().length < 2) problems.push("Escribí tu nombre.");
  if (!email.includes("@")) problems.push("Escribí un email válido.");
  if (clinicName.trim().length < 2) problems.push("Escribí el nombre de tu clínica o laboratorio.");

  const requiredInputs = new Set<string>();
  items.forEach((i) =>
    getDesignService(i.service_code)?.requiredInputs.forEach((r) => requiredInputs.add(r)),
  );

  async function handleSubmit() {
    setIsSending(true);
    setError(null);
    setAccountExists(false);

    try {
      const response = await fetch("/api/design/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          clinic_name: clinicName.trim(),
          country: country.trim() || null,
          phone: phone.trim() || null,
          patient_ref: patientRef.trim() || null,
          case_notes: caseNotes.trim() || null,
          items: items.map((i) => ({
            service_code: i.service_code,
            tooth_positions: i.tooth_positions
              .split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
            arch: i.arch,
            quantity: i.quantity,
            notes: i.notes.trim() || null,
          })),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (payload?.code === "account_exists") setAccountExists(true);
        throw new Error(payload?.error ?? "No se pudo enviar la solicitud");
      }

      // El servidor ya dejó la sesión iniciada: se navega a una ruta
      // propia, sin depender del redirect de Supabase.
      if (payload?.data?.session_started && payload?.data?.next_url) {
        window.location.href = payload.data.next_url;
        return;
      }
      // Red de seguridad: si la sesión no se pudo iniciar, queda el
      // enlace externo.
      if (payload?.data?.access_url) {
        window.location.href = payload.data.access_url;
        return;
      }
      window.location.href = "/auth/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* ─── Qué necesitás ────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#044c64]">1 · Qué necesitás</h2>
          <p className="text-sm text-slate-500">
            Elegí el trabajo. Podés pedir varios en la misma orden.
          </p>
        </div>

        {items.map((item, index) => {
          const service = getDesignService(item.service_code);

          return (
            <div key={item.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`s-${item.key}`}>Tipo de trabajo</Label>
                  <Select
                    value={item.service_code}
                    onValueChange={(v) =>
                      patch(item.key, { service_code: v, tooth_positions: "", arch: null })
                    }
                  >
                    <SelectTrigger id={`s-${item.key}`}>
                      <SelectValue placeholder="Elegí el servicio de diseño">{service?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {groupServicesByCategory().map((g) => (
                        <SelectGroup key={g.category}>
                          <SelectLabel>{g.label}</SelectLabel>
                          {g.services.map((s) => (
                            <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {service && <p className="text-xs text-slate-500">{service.description}</p>}
                </div>

                <div className="w-20 space-y-1.5">
                  <Label htmlFor={`q-${item.key}`}>Cant.</Label>
                  <Input
                    id={`q-${item.key}`}
                    type="number" min={1} max={99}
                    value={item.quantity}
                    onChange={(e) =>
                      patch(item.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>

                {items.length > 1 && (
                  <Button
                    type="button" variant="ghost" size="icon" className="mt-7"
                    onClick={() => setItems((p) => p.filter((i) => i.key !== item.key))}
                    aria-label={`Quitar servicio ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                )}
              </div>

              {service?.requiresTeeth && (
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor={`t-${item.key}`}>Piezas dentarias</Label>
                  <Input
                    id={`t-${item.key}`}
                    value={item.tooth_positions}
                    onChange={(e) => patch(item.key, { tooth_positions: e.target.value })}
                    placeholder="Ej: 11, 12, 21"
                  />
                  <p className="text-xs text-slate-500">Numeración FDI, separadas por coma.</p>
                </div>
              )}

              {service?.requiresArch && (
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor={`a-${item.key}`}>Arcada</Label>
                  <Select
                    value={item.arch ?? ""}
                    onValueChange={(v) => patch(item.key, { arch: v as DesignArch })}
                  >
                    <SelectTrigger id={`a-${item.key}`} className="sm:w-60">
                      <SelectValue placeholder="Elegí la arcada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upper">Superior</SelectItem>
                      <SelectItem value="lower">Inferior</SelectItem>
                      <SelectItem value="both">Ambas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {service && (
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor={`n-${item.key}`}>Indicaciones (opcional)</Label>
                  <Textarea
                    id={`n-${item.key}`} rows={2} maxLength={1000}
                    value={item.notes}
                    onChange={(e) => patch(item.key, { notes: e.target.value })}
                    placeholder="Material, color, espesor de cemento, contactos…"
                  />
                </div>
              )}
            </div>
          );
        })}

        <Button type="button" variant="outline" onClick={() => setItems((p) => [...p, emptyItem()])}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar otro servicio
        </Button>
      </section>

      {/* ─── Tus datos ────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#044c64]">2 · Tus datos</h2>
          <p className="text-sm text-slate-500">
            Con esto creamos tu acceso para que subas los escaneos y recibas el diseño.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre y apellido</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clinic">Clínica o laboratorio</Label>
            <Input id="clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">País (opcional)</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref">Referencia del caso (opcional)</Label>
            <Input id="ref" value={patientRef} onChange={(e) => setPatientRef(e.target.value)} maxLength={120} placeholder="Iniciales o nº interno" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Algo más que debamos saber (opcional)</Label>
          <Textarea id="notes" rows={3} maxLength={4000} value={caseNotes} onChange={(e) => setCaseNotes(e.target.value)} />
        </div>
      </section>

      {/* ─── Qué pasa después ─────────────────────────────── */}
      {requiredInputs.size > 0 && (
        <div className="flex gap-2 rounded-xl border border-[#b0dde0] bg-[#e0f4f6]/40 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#09919b]" aria-hidden="true" />
          <div className="text-sm text-[#044c64]">
            <p className="font-medium">Al enviar vas a entrar directo a subir los archivos.</p>
            <p className="mt-1 text-[#0d687d]">
              Tené a mano: {Array.from(requiredInputs)
                .map((k) => REQUIRED_INPUT_LABELS[k as keyof typeof REQUIRED_INPUT_LABELS])
                .filter(Boolean).join(" · ")}.
            </p>
            <p className="mt-1 text-xs text-[#0d687d]">
              Si tu escáner exporta todo en un .zip, con ese archivo alcanza.
              Aceptamos .stl, .ply, .obj, .dcm y .zip.
            </p>
          </div>
        </div>
      )}

      {/* ─── Enviar ───────────────────────────────────────── */}
      <section className="space-y-3 border-t pt-6">
        {problems.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
            {problems.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className={cn("rounded-lg border p-3 text-sm",
            accountExists
              ? "border-[#b0dde0] bg-[#e0f4f6]/50 text-[#044c64]"
              : "border-red-200 bg-red-50 text-red-700")}>
            <p>{error}</p>
            {accountExists && (
              <a href="/auth/login" className="mt-1 inline-block font-medium underline">
                Iniciar sesión y pedirlo desde tu panel →
              </a>
            )}
          </div>
        )}

        <Button
          type="button" size="lg"
          onClick={handleSubmit}
          disabled={isSending || problems.length > 0}
        >
          {isSending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <ArrowRight className="mr-2 h-4 w-4" />}
          Enviar y subir los escaneos
        </Button>

        <p className="text-xs text-slate-500">
          El diseño terminado se descarga una vez abonado. Te enviamos la factura
          antes de empezar.
        </p>
      </section>
    </div>
  );
}
