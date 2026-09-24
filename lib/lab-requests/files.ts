/**
 * [040_lab_requests] Reglas del archivo adjunto a una solicitud.
 *
 * Bucket PRIVADO propio. No va a 'case-files' (que es público) porque
 * un escaneo intraoral es dato clínico y porque el visitante no tiene
 * sesión: sube por URL firmada que emite el servidor.
 */

export const LAB_REQUEST_BUCKET = "lab-request-files";

/** 200 MB. Mismo límite que declara el bucket en 040. */
export const MAX_LAB_REQUEST_FILE_BYTES = 200 * 1024 * 1024;

/** Vida de la URL firmada de descarga para el laboratorio. */
export const LAB_REQUEST_SIGNED_URL_TTL = 300;

/** Mallas y exports de escáner. Sin imágenes: eso va en las notas. */
export const ACCEPTED_LAB_REQUEST_EXTENSIONS = [
  ".stl", ".ply", ".obj", ".zip", ".3oxz", ".dxd", ".xorder", ".3mf",
];

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot).toLowerCase();
}

export function validateLabRequestFile(
  fileName: string,
  fileSize: number,
): { ok: true } | { ok: false; error: string } {
  const ext = getExtension(fileName);
  if (!ACCEPTED_LAB_REQUEST_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      error: `Formato no aceptado (${ext || "sin extensión"}). Subí ${ACCEPTED_LAB_REQUEST_EXTENSIONS.join(", ")}.`,
    };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (fileSize > MAX_LAB_REQUEST_FILE_BYTES) {
    return { ok: false, error: "El archivo supera los 200 MB. Comprimilo en ZIP o dividilo." };
  }
  return { ok: true };
}

/**
 * Nombre seguro para el bucket: sin rutas, sin espacios, sin caracteres
 * fuera de ASCII. Se conserva la extensión original.
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "archivo";
  const cleaned = base
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+/, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "archivo";
}

/** {request_id}/{archivo}: la policy de storage lee la carpeta. */
export function buildLabRequestStoragePath(requestId: string, fileName: string): string {
  return `${requestId}/${sanitizeFileName(fileName)}`;
}
