"use client";

/**
 * [040_lab_requests] Formulario público de fresado / impresión.
 *
 * Tres bloques: qué necesitás → archivo → tus datos. Reglas propias:
 *   - La card de la landing llega con ?producto=<key>; se preselecciona
 *     SOLO si existe en el mapa. Un valor inventado deja el select vacío.
 *   - Fuera de Uruguay no se envía: se muestra el aviso y el camino al
 *     diseño digital. La compuerta también existe del lado servidor.
 *   - Un doble clic no crea dos solicitudes: la clave de idempotencia se
 *     genera una vez por formulario y viaja en cada reintento.
 *   - Si el archivo no llega, la solicitud igual queda registrada y se
 *     ofrece reintentar: nada se pierde en silencio.
 *   - No se pide el nombre del paciente: solo un código de referencia.
 */

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getLabProduct, LAB_BLOCK_LABELS, LAB_PRODUCTS, type LabProductBlock,
} from "@/lib/lab-requests/products";
import { COUNTRY_OPTIONS, isServiceableCountry, URUGUAY_DEPARTMENTS } from "@/lib/lab-requests/country";
import { ACCEPTED_LAB_REQUEST_EXTENSIONS, validateLabRequestFile } from "@/lib/lab-requests/files";
import {
  ApiError, confirmLabRequestFile, createLabRequest, uploadToSignedUrl,
  type LabRequestCreated,
} from "@/lib/lab-requests/client-api";
import { OUT_OF_SCOPE_MESSAGE } from "@/content/servicios";
import {
  AlertCircle, ArrowRight, CheckCircle2, FileUp, Info, Loader2, RefreshCw, UploadCloud,
} from "lucide-react";

type Phase = "idle" | "sending" | "uploading" | "confirming" | "done";
type FileMode = "upload" | "existing" | "none";

// Sin precios: fresado e impresión se cotizan por solicitud, el laboratorio
// confirma el total antes de producir.
type Props = Record<string, never>;

const BLOCKS: LabProductBlock[] = ["fresado", "impresion"];

export function LabRequestForm(_props: Props) {
  const uid = useId();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("producto");
  const initialProduct = fromUrl && getLabProduct(fromUrl) ? fromUrl : "";

  // ─── Estado ────────────────────────────────────────────────────
  const [productKey, setProductKey] = useState(initialProduct);
  const [quantity, setQuantity] = useState(1);
  const [teeth, setTeeth] = useState("");
  const [shade, setShade] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");

  const [fileMode, setFileMode] = useState<FileMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [existingCaseRef, setExistingCaseRef] = useState("");

  const [professionalName, setProfessionalName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("UY");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabRequestCreated | null>(null);
  const [fileDelivered, setFileDelivered] = useState<boolean | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Una clave por formulario. Se genera en el navegador, en el primer
  // envío: nunca en el render, así el servidor y el cliente no difieren.
  const idempotencyKey = useRef<string | null>(null);

  const product = getLabProduct(productKey);
  const inScope = isServiceableCountry(country);
  const busy = phase !== "idle" && phase !== "done";

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!product) list.push("el producto");
    if (professionalName.trim().length < 2) list.push("tu nombre");
    if (clinicName.trim().length < 2) list.push("la clínica o consultorio");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) list.push("un email válido");
    if (product?.file === "required" && fileMode === "upload" && !file) list.push("el archivo STL");
    if (product?.file === "required" && fileMode === "existing" && !existingCaseRef.trim()) list.push("el número del caso");
    if (product?.file === "required" && fileMode === "none") list.push("el archivo STL");
    if (!acceptedTerms) list.push("aceptar los términos");
    return list;
  }, [product, professionalName, clinicName, email, fileMode, file, existingCaseRef, acceptedTerms]);

  function onPickFile(f: File | null) {
    setFileError(null);
    if (!f) { setFile(null); return; }
    const check = validateLabRequestFile(f.name, f.size);
    if (!check.ok) { setFile(null); setFileError(check.error); return; }
    setFile(f);
  }

  // ─── Subida + confirmación (reutilizable para reintentar) ───────
  async function deliverFile(created: LabRequestCreated, f: File) {
    if (!created.upload || !created.id) { setFileDelivered(false); return; }
    setPhase("uploading");
    setProgress(0);
    await uploadToSignedUrl(created.upload.signed_url, f, setProgress);
    setPhase("confirming");
    await confirmLabRequestFile(created.id, created.upload.storage_path);
    setFileDelivered(true);
  }

  async function handleSubmit() {
    if (busy) return;
    setError(null);
    setWarning(null);

    if (!inScope) return;
    if (missing.length > 0) {
      setError(`Falta ${missing.join(", ")}.`);
      return;
    }

    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    setPhase("sending");
    try {
      const wantsFile = fileMode === "upload" && file;
      const { data: created, warning: w } = await createLabRequest({
        website,
        idempotency_key: idempotencyKey.current,
        professional_name: professionalName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        clinic_name: clinicName.trim(),
        country,
        department: department || null,
        city: city.trim() || null,
        address: address.trim() || null,
        product_key: productKey,
        quantity,
        tooth_positions: teeth.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
        shade: shade.trim() || null,
        urgency,
        patient_ref: patientRef.trim() || null,
        notes: notes.trim() || null,
        file: wantsFile ? { name: file.name, size: file.size } : null,
        existing_case_ref: fileMode === "existing" ? existingCaseRef.trim() || null : null,
        accepted_terms: true,
      });

      setResult(created);
      if (w) setWarning(w);

      if (wantsFile) {
        try {
          await deliverFile(created, file);
        } catch (e) {
          // La solicitud ya existe. Se informa y se ofrece reintentar.
          setFileDelivered(false);
          setWarning(e instanceof Error ? e.message : "El archivo no se pudo subir.");
        }
      } else {
        setFileDelivered(null);
      }
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiError && e.payload?.code === "out_of_scope") {
        setError(e.payload.error);
        return;
      }
      setError(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    }
  }

  async function retryUpload() {
    if (!result || !file) return;
    setWarning(null);
    try {
      await deliverFile(result, file);
      setPhase("done");
    } catch (e) {
      setPhase("done");
      setFileDelivered(false);
      setWarning(e instanceof Error ? e.message : "El archivo no se pudo subir.");
    }
  }

  // ─── Pantalla final ────────────────────────────────────────────
  if (phase === "done" && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Solicitud recibida</h2>
              <p className="mt-1 text-sm text-emerald-800">
                Tu número es <strong className="font-mono">{result.request_number}</strong>.
                El laboratorio la revisa, te confirma precio y plazo por email
                {phone ? " o WhatsApp" : ""} y la ingresa a producción.
              </p>
            </div>
          </div>
        </div>

        {fileDelivered === true && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            Archivo <span className="font-medium">{file?.name}</span> recibido.
          </p>
        )}

        {fileDelivered === false && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">El archivo no llegó.</p>
            <p className="mt-1">{warning ?? "La solicitud quedó registrada igual; el laboratorio te lo va a pedir."}</p>
            {result.upload && file && (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retryUpload} disabled={busy}>
                <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} aria-hidden />
                Reintentar subida
              </Button>
            )}
          </div>
        )}

        {fileDelivered !== false && warning && (
          <p className="text-sm text-amber-800">{warning}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/disenos/solicitar">¿También necesitás diseño? Pedilo acá</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Formulario ────────────────────────────────────────────────
  return (
    <form
      className="mx-auto max-w-3xl space-y-10"
      onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
      noValidate
    >
      {/* Honeypot: fuera de flujo de tab y de lectores de pantalla. */}
      <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Sitio web</label>
        <input
          id={`${uid}-website`} name="website" type="text" tabIndex={-1} autoComplete="off"
          value={website} onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {/* ─── 1 · Qué necesitás ─────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#044c64]">1 · Qué necesitás</h2>
          <p className="text-sm text-slate-500">Un producto por solicitud. Si son varios, mandá una por cada uno.</p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-product`}>Producto</Label>
            <Select value={productKey} onValueChange={(v) => { setProductKey(v); setTeeth(""); setShade(""); }}>
              <SelectTrigger id={`${uid}-product`}>
                <SelectValue placeholder="Elegí el producto">{product?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BLOCKS.map((block) => (
                  <SelectGroup key={block}>
                    <SelectLabel>{LAB_BLOCK_LABELS[block]}</SelectLabel>
                    {LAB_PRODUCTS.filter((p) => p.block === block).map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {product && (
              <p className="flex items-start gap-1.5 pt-1 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {product.material}. El laboratorio te confirma precio y plazo antes de producir.
                </span>
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-qty`}>Cantidad{product ? ` (${product.unit}s)` : ""}</Label>
              <Input
                id={`${uid}-qty`} type="number" min={1} max={99} inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            {product?.asksTeeth && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-teeth`}>Piezas (FDI)</Label>
                <Input
                  id={`${uid}-teeth`} placeholder="16, 26" value={teeth}
                  onChange={(e) => setTeeth(e.target.value)}
                />
              </div>
            )}
            {product?.asksShade && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-shade`}>Color</Label>
                <Input
                  id={`${uid}-shade`} placeholder="A2, B1…" value={shade}
                  onChange={(e) => setShade(e.target.value)}
                />
              </div>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Plazo</legend>
            <div className="flex flex-wrap gap-2">
              {([["normal", "Plazo normal"], ["urgent", "Urgente"]] as const).map(([v, label]) => (
                <label
                  key={v}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition",
                    urgency === v
                      ? "border-[#09919b] bg-[#09919b]/10 text-[#044c64]"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                >
                  <input
                    type="radio" name="urgency" value={v} className="sr-only"
                    checked={urgency === v} onChange={() => setUrgency(v)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      {/* ─── 2 · Archivo ───────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#044c64]">2 · Archivo</h2>
          <p className="text-sm text-slate-500">
            {product?.file === "required"
              ? "Para fresar tu STL necesitamos el archivo, o el número de un caso que ya tengamos."
              : "Si ya tenés el STL o el escaneo, subilo. Si no, lo escaneamos o diseñamos nosotros."}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo llega el archivo">
            {([
              ["upload", "Subir archivo"],
              ["existing", "Ya tengo un caso con ustedes"],
              ...(product?.file === "required" ? [] : [["none", "Sin archivo"] as const]),
            ] as ReadonlyArray<readonly [FileMode, string]>).map(([v, label]) => (
              <label
                key={v}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition",
                  fileMode === v
                    ? "border-[#09919b] bg-[#09919b]/10 text-[#044c64]"
                    : "border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                <input
                  type="radio" name="fileMode" value={v} className="sr-only"
                  checked={fileMode === v} onChange={() => setFileMode(v)}
                />
                {label}
              </label>
            ))}
          </div>

          {fileMode === "upload" && (
            <div className="space-y-2">
              <label
                htmlFor={`${uid}-file`}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
                  file ? "border-[#09919b] bg-[#09919b]/5" : "border-slate-300 hover:border-[#09919b]",
                )}
              >
                {file ? <FileUp className="h-6 w-6 text-[#09919b]" aria-hidden /> : <UploadCloud className="h-6 w-6 text-slate-400" aria-hidden />}
                <span className="text-sm font-medium text-slate-700">
                  {file ? file.name : "Elegí el archivo"}
                </span>
                <span className="text-xs text-slate-500">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : `${ACCEPTED_LAB_REQUEST_EXTENSIONS.join(" · ")} · hasta 200 MB`}
                </span>
                <input
                  id={`${uid}-file`} type="file" className="sr-only"
                  accept={ACCEPTED_LAB_REQUEST_EXTENSIONS.join(",")}
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {fileError && (
                <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" aria-hidden /> {fileError}
                </p>
              )}
            </div>
          )}

          {fileMode === "existing" && (
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-case`}>Número de orden o referencia del caso</Label>
              <Input
                id={`${uid}-case`} placeholder="ORDEN 128" value={existingCaseRef}
                onChange={(e) => setExistingCaseRef(e.target.value)}
              />
            </div>
          )}
        </div>
      </section>

      {/* ─── 3 · Tus datos ─────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#044c64]">3 · Tus datos</h2>
          <p className="text-sm text-slate-500">Del profesional, no del paciente. Para el paciente usá un código interno.</p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-name`}>Nombre y apellido</Label>
              <Input id={`${uid}-name`} autoComplete="name" value={professionalName} onChange={(e) => setProfessionalName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-clinic`}>Clínica o consultorio</Label>
              <Input id={`${uid}-clinic`} autoComplete="organization" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-email`}>Email</Label>
              <Input id={`${uid}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-phone`}>Teléfono / WhatsApp <span className="text-slate-400">(opcional)</span></Label>
              <Input id={`${uid}-phone`} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-country`}>País</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id={`${uid}-country`}>
                  <SelectValue>{COUNTRY_OPTIONS.find((c) => c.code === country)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inScope && (
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-dept`}>Departamento</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id={`${uid}-dept`}><SelectValue placeholder="Elegí">{department || undefined}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {URUGUAY_DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!inScope && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-amber-900">{OUT_OF_SCOPE_MESSAGE.title}</p>
              <p className="mt-1 text-sm text-amber-800">{OUT_OF_SCOPE_MESSAGE.body}</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/disenos/solicitar">
                  {OUT_OF_SCOPE_MESSAGE.cta} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          )}

          {inScope && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-city`}>Ciudad <span className="text-slate-400">(opcional)</span></Label>
                <Input id={`${uid}-city`} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-address`}>Dirección de entrega <span className="text-slate-400">(opcional)</span></Label>
                <Input id={`${uid}-address`} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-ref`}>Referencia del paciente <span className="text-slate-400">(opcional, código interno)</span></Label>
              <Input id={`${uid}-ref`} placeholder="P-0421" value={patientRef} onChange={(e) => setPatientRef(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-notes`}>Indicaciones <span className="text-slate-400">(opcional)</span></Label>
            <Textarea
              id={`${uid}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Oclusión, antagonista, línea de terminación, lo que el técnico tenga que saber."
            />
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <Checkbox
              id={`${uid}-terms`} checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(v === true)}
              aria-describedby={`${uid}-terms-help`}
            />
            {/* Sin enlaces: las páginas legales todavía no existen (el footer
                apunta a "#"). Cuando existan, van acá. */}
            <Label htmlFor={`${uid}-terms`} className="text-sm font-normal leading-snug text-slate-600">
              Acepto los términos del servicio y la política de privacidad.
              <span id={`${uid}-terms-help`} className="block text-xs text-slate-400">
                Usamos tus datos solo para gestionar este trabajo. No pedimos datos del paciente.
              </span>
            </Label>
          </div>
        </div>
      </section>

      {/* ─── Enviar ─────────────────────────────────────────── */}
      <section className="space-y-3 border-t pt-6">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-pre-line">{error}</span>
          </p>
        )}

        {phase === "uploading" && (
          <div className="space-y-1" aria-live="polite">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subiendo {file?.name}</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[#09919b] transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Sin registro. El laboratorio te contacta para confirmar precio y plazo.
          </p>
          <Button
            type="submit" size="lg"
            className="bg-[#044c64] hover:bg-[#04405a]"
            disabled={busy || !inScope}
            aria-disabled={busy || !inScope}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {phase === "sending" ? "Enviando…" : phase === "uploading" ? "Subiendo archivo…" : "Confirmando…"}
              </>
            ) : (
              <>Enviar solicitud <ArrowRight className="ml-2 h-4 w-4" aria-hidden /></>
            )}
          </Button>
        </div>
      </section>
    </form>
  );
}
