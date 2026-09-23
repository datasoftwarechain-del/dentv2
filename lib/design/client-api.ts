"use client";

/**
 * [035_design_studio] Cliente del módulo de diseño.
 *
 * Centraliza el CSRF y, sobre todo, el flujo de subida en tres pasos:
 * pedir URL firmada → subir al bucket → confirmar. El paso de confirmar
 * es el que evita el fantasma que tiene hoy "Casos Digitales": una fila
 * en la base apuntando a un archivo que nunca llegó.
 *
 * Todas las funciones lanzan Error con el mensaje del servidor. Nada se
 * traga en silencio.
 */

import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET, validateDesignFile } from "./files";
import type { DesignFileKind, DesignOrderDetail, DesignOrderFile } from "./types";
import type { DesignOrderStatus } from "./status";

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken(),
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    // El 422 de la compuerta de envío trae la lista de qué falta:
    // se muestra entera, no solo el encabezado.
    const details = Array.isArray(payload?.details) ? `\n· ${payload.details.join("\n· ")}` : "";
    throw new Error((payload?.error ?? `Error ${response.status}`) + details);
  }

  return payload?.data ?? payload;
}

// ─── Órdenes ──────────────────────────────────────────────────

export interface CreateOrderItemInput {
  service_code: string;
  catalog_item_id?: string | null;
  tooth_positions?: string[] | null;
  arch?: "upper" | "lower" | "both" | null;
  quantity: number;
  notes?: string | null;
}

export function createDesignOrder(input: {
  /** El cliente manda esto: a qué estudio le pide el trabajo. */
  studio_org_id?: string;
  /** El estudio manda esto: para qué cliente carga la orden. */
  client_org_id?: string;
  patient_ref?: string | null;
  case_notes?: string | null;
  priority?: "normal" | "urgent";
  items: CreateOrderItemInput[];
}) {
  return request<{ id: string; order_number: string }>("/api/design/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getDesignOrder(id: string) {
  return request<DesignOrderDetail & { side: "client" | "studio"; payment_mode: string }>(
    `/api/design/orders/${id}`,
  );
}

export function changeDesignOrderStatus(
  id: string,
  toStatus: DesignOrderStatus,
  options?: { message?: string; assignedTo?: string },
) {
  return request(`/api/design/orders/${id}/status`, {
    method: "POST",
    body: JSON.stringify({
      to_status: toStatus,
      message: options?.message ?? null,
      assigned_to: options?.assignedTo ?? null,
    }),
  });
}

export function discardDesignOrder(id: string) {
  return request(`/api/design/orders/${id}`, { method: "DELETE" });
}

// ─── Archivos ─────────────────────────────────────────────────

export function listDesignFiles(orderId: string) {
  return request<Array<DesignOrderFile & { download_url: string | null; locked: boolean }>>(
    `/api/design/orders/${orderId}/files`,
  );
}

/**
 * Sube un archivo de punta a punta.
 *
 * `onProgress` reporta 0→100. Es progreso real de red (XHR), no una
 * animación: si la subida se frena, la barra se frena.
 */
export async function uploadDesignFile(
  orderId: string,
  file: File,
  kind: DesignFileKind,
  onProgress?: (percent: number) => void,
): Promise<DesignOrderFile> {
  // 1. Validar antes de gastar red.
  const check = validateDesignFile(file.name, file.size, kind);
  if (!check.ok) throw new Error(check.error);

  // 2. Pedir la URL firmada. La ruta y la versión las decide el servidor.
  const ticket = await request<{
    storage_path: string;
    version: number;
    token: string;
    signed_url: string;
  }>(`/api/design/orders/${orderId}/files`, {
    method: "POST",
    body: JSON.stringify({ file_name: file.name, file_size: file.size, kind }),
  });

  // 3. Subir al bucket contra la URL firmada, con progreso real.
  await uploadToSignedUrl(ticket.signed_url, file, onProgress);

  // 4. Confirmar. Recién acá se registra la fila, y el servidor verifica
  //    contra el bucket que el objeto exista de verdad.
  return request<DesignOrderFile>(`/api/design/orders/${orderId}/files`, {
    method: "PATCH",
    body: JSON.stringify({
      storage_path: ticket.storage_path,
      file_name: file.name,
      file_size: file.size,
      kind,
      version: ticket.version,
      mime_type: file.type || "application/octet-stream",
    }),
  });
}

/**
 * PUT contra la URL firmada de Supabase Storage usando XHR.
 *
 * Se usa XHR y no fetch porque fetch no expone progreso de subida, y en
 * archivos de cientos de megabytes una barra que no se mueve es
 * indistinguible de una subida colgada.
 */
function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`La subida falló (${xhr.status}). Reintentá.`));
      }
    };
    xhr.onerror = () => reject(new Error("Se cortó la conexión durante la subida."));
    xhr.onabort = () => reject(new Error("Subida cancelada."));

    xhr.send(file);
  });
}

/** Descarga por URL firmada. El servidor ya decidió si está permitida. */
export function downloadDesignFile(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Referencia al bucket, para quien necesite el cliente de storage directo. */
export { DESIGN_BUCKET, createClient as createStorageClient };
