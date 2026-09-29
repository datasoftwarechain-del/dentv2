"use client";

/**
 * [043] Portal de entrega del diseñador.
 *
 * Lo ve alguien sin cuenta, probablemente una sola vez y apurado. De ahí
 * las decisiones de la pantalla:
 *
 *   - Un paso a la vez. Primero aceptar, y recién ahí aparece la subida.
 *     Mostrar las dos juntas invita a subir sin aceptar, que el servidor
 *     rechaza y confunde.
 *   - Progreso real de red (XHR), no una animación. En archivos de cientos
 *     de megas una barra que no se mueve es indistinguible de una subida
 *     colgada.
 *   - Se valida antes de gastar red, con la misma función que el estudio.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { validateDesignFile, formatBytes } from "@/lib/design/files";
import {
  Loader2, AlertCircle, CheckCircle2, Download, Upload, FileCheck2, Clock,
} from "lucide-react";

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

interface Item {
  description: string | null;
  service_code: string | null;
  quantity: number | null;
  tooth_positions: string[] | null;
  arch: string | null;
  notes: string | null;
}

interface Archivo {
  id: string;
  file_name: string;
  file_size: number | null;
  kind: string;
  url: string | null;
}

interface Props {
  token: string;
  designerName: string;
  studioName: string;
  aceptado: boolean;
  vencimiento: string;
  order: {
    order_number: string;
    patient_ref: string | null;
    case_notes: string | null;
    priority: string;
    due_at: string | null;
  };
  items: Item[];
  archivos: Archivo[];
  yaEntregados: Array<{ id: string; file_name: string; created_at: string }>;
}

function fecha(iso: string | null): string {
  if (!iso) return "sin fecha límite";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha límite";
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function describir(item: Item): string {
  const p: string[] = [item.description?.trim() || item.service_code || "Trabajo de diseño"];
  if (item.quantity && item.quantity > 1) p.push(`×${item.quantity}`);
  if (item.tooth_positions?.length) p.push(`piezas ${item.tooth_positions.join(", ")}`);
  if (item.arch) p.push(item.arch);
  if (item.notes?.trim()) p.push(item.notes.trim());
  return p.join(" · ");
}

function subirConProgreso(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); }
      else reject(new Error(`La subida falló (${xhr.status}). Reintentá.`));
    };
    xhr.onerror = () => reject(new Error("Se cortó la conexión durante la subida."));
    xhr.onabort = () => reject(new Error("Subida cancelada."));
    xhr.send(file);
  });
}

export function DeliveryPortal(props: Props) {
  const router = useRouter();
  const { token, order } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [aceptado, setAceptado] = useState(props.aceptado);
  const [rechazado, setRechazado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entregado, setEntregado] = useState<{ nombre: string; destino: string | null } | null>(null);

  async function accion(action: "accept" | "decline") {
    setTrabajando(true);
    setError(null);
    try {
      const res = await fetch(`/api/entrega/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify(action === "decline" ? { action, reason: motivo || null } : { action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo completar la acción");
      if (action === "accept") setAceptado(true);
      else setRechazado(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setTrabajando(false);
    }
  }

  async function subir(file: File) {
    const check = validateDesignFile(file.name, file.size, "output_design");
    if (!check.ok) { setError(check.error ?? "Archivo no admitido"); return; }

    setTrabajando(true);
    setError(null);
    setProgreso(0);
    try {
      const pedir = await fetch(`/api/entrega/${token}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ file_name: file.name, file_size: file.size }),
      });
      const ticket = await pedir.json().catch(() => ({}));
      if (!pedir.ok) throw new Error(ticket?.error ?? "No se pudo preparar la subida");

      await subirConProgreso(ticket.data.signed_url, file, setProgreso);

      const confirmar = await fetch(`/api/entrega/${token}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({
          storage_path: ticket.data.storage_path,
          file_name: file.name,
          file_size: file.size,
          version: ticket.data.version,
          mime_type: file.type || "application/octet-stream",
        }),
      });
      const hecho = await confirmar.json().catch(() => ({}));
      if (!confirmar.ok) throw new Error(hecho?.error ?? "No se pudo registrar el archivo");

      setEntregado({ nombre: file.name, destino: hecho?.data?.destino ?? null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setTrabajando(false);
      setProgreso(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (rechazado) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-800">Caso liberado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Avisamos a {props.studioName} para que lo reasigne. Gracias por responder.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Hola {props.designerName}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#044c64]">
          Caso {order.order_number}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{props.studioName} te asignó este caso.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Referencia</dt>
            <dd className="mt-1 text-sm text-slate-700">{order.patient_ref || "sin referencia"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Prioridad</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {order.priority === "urgent" ? "Urgente" : "Normal"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Fecha límite</dt>
            <dd className="mt-1 text-sm text-slate-700">{fecha(order.due_at)}</dd>
          </div>
        </dl>

        <h2 className="mt-6 text-sm font-semibold text-slate-800">Trabajo</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {props.items.length === 0 && <li>Sin detalle cargado.</li>}
          {props.items.map((i, n) => <li key={n}>· {describir(i)}</li>)}
        </ul>

        {order.case_notes?.trim() && (
          <>
            <h2 className="mt-6 text-sm font-semibold text-slate-800">Notas del caso</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{order.case_notes}</p>
          </>
        )}
      </section>

      {props.archivos.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800">Archivos del cliente</h2>
          <ul className="mt-3 space-y-2">
            {props.archivos.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 truncate text-slate-600">
                  {a.file_name}
                  {a.file_size ? (
                    <span className="ml-2 text-xs text-slate-400">{formatBytes(a.file_size)}</span>
                  ) : null}
                </span>
                {a.url ? (
                  <a
                    href={a.url}
                    className="inline-flex shrink-0 items-center gap-1.5 text-[#09919b] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Descargar
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-amber-600">no disponible</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!aceptado ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800">¿Tomás este caso?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Al aceptarlo, el estudio ve que está en curso y se habilita la subida del diseño.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => void accion("accept")} disabled={trabajando} className="gap-2">
              {trabajando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Acepto el caso
            </Button>
            <Button
              variant="outline"
              onClick={() => setMostrarRechazo((v) => !v)}
              disabled={trabajando}
            >
              No puedo tomarlo
            </Button>
          </div>

          {mostrarRechazo && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <Textarea
                rows={2}
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (opcional). Ayuda al estudio a reasignarlo mejor."
              />
              <Button variant="destructive" size="sm" onClick={() => void accion("decline")} disabled={trabajando}>
                Confirmar que no puedo
              </Button>
            </div>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Este enlace vence el {fecha(props.vencimiento)}.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800">Subir el diseño terminado</h2>
          <p className="mt-1 text-sm text-slate-600">
            STL, PLY, OBJ, ZIP o 3MF. Hasta 500 MB. No lo mandes por correo: no entra.
          </p>

          {entregado && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Recibimos {entregado.nombre}.{" "}
              {entregado.destino === "client_review"
                ? "Ya se lo mandamos al cliente para que lo revise."
                : "El estudio lo revisa y sigue desde ahí."}{" "}
              Podés cerrar esta página.
            </p>
          )}

          {progreso !== null && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-[#09919b] transition-[width]"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Subiendo… {progreso}%</p>
            </div>
          )}

          <div className="mt-4">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              id="archivo-diseno"
              accept=".stl,.ply,.obj,.zip,.3mf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subir(f);
              }}
            />
            <Button asChild disabled={trabajando} className="gap-2">
              <label htmlFor="archivo-diseno" className="cursor-pointer">
                {trabajando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {trabajando ? "Subiendo…" : "Elegir archivo"}
              </label>
            </Button>
          </div>

          {props.yaEntregados.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ya entregado
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {props.yaEntregados.map((e) => (
                  <li key={e.id}>· {e.file_name}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
