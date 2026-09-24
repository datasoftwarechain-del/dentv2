"use client";

/**
 * [040_lab_requests] Cliente del formulario público y de la bandeja.
 *
 * Subida en tres pasos, igual que el módulo de diseño: crear la
 * solicitud → PUT contra la URL firmada con progreso real → confirmar.
 * Si el PUT falla, la solicitud YA existe con "archivo no llegó": el
 * profesional ve el número y el laboratorio sabe que tiene que pedirlo.
 */

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload: any) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<{ data: T; warning?: string }> {
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
    const details = Array.isArray(payload?.details) ? `\n· ${payload.details.join("\n· ")}` : "";
    throw new ApiError((payload?.error ?? `Error ${response.status}`) + details, response.status, payload);
  }
  return { data: payload?.data ?? payload, warning: payload?.warning };
}

// ─── Público ──────────────────────────────────────────────────

export interface LabRequestInput {
  website?: string;
  idempotency_key: string;
  professional_name: string;
  email: string;
  phone?: string | null;
  clinic_name: string;
  country: string;
  department?: string | null;
  city?: string | null;
  address?: string | null;
  product_key: string;
  quantity: number;
  tooth_positions?: string[] | null;
  shade?: string | null;
  urgency: "normal" | "urgent";
  patient_ref?: string | null;
  notes?: string | null;
  file?: { name: string; size: number } | null;
  existing_case_ref?: string | null;
  accepted_terms: true;
}

export interface LabRequestCreated {
  id: string | null;
  request_number: string;
  upload: { storage_path: string; token: string; signed_url: string } | null;
}

export function createLabRequest(input: LabRequestInput) {
  return request<LabRequestCreated>("/api/lab-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function confirmLabRequestFile(id: string, storagePath: string) {
  return request<{ file_status: string }>(`/api/lab-requests/${id}/file`, {
    method: "PATCH",
    body: JSON.stringify({ storage_path: storagePath }),
  });
}

/** PUT con XHR para tener progreso real de red. */
export function uploadToSignedUrl(
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

// ─── Laboratorio ──────────────────────────────────────────────

export function getLabRequest(id: string) {
  return request<any>(`/api/lab-requests/${id}`);
}

export function rejectLabRequest(id: string, reason: string | null) {
  return request<{ id: string; status: string }>(`/api/lab-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "reject", reason }),
  });
}

export interface ConvertInput {
  dentist_org_id?: string | null;
  new_clinic?: { name: string; email?: string | null; phone?: string | null; address?: string | null; city?: string | null } | null;
  work_type: string;
  catalog_item_id?: string | null;
  unit_price?: number | null;
  due_date?: string | null;
  internal_notes?: string | null;
}

export function convertLabRequest(id: string, input: ConvertInput) {
  return request<{ lab_order_id: string; order_number?: string; already?: boolean }>(
    `/api/lab-requests/${id}/convert`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
