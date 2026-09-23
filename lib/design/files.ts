/**
 * [035_design_studio] Reglas de archivos del estudio de diseño.
 *
 * Todo lo que toca el bucket `design-files` pasa por acá: qué se acepta,
 * cuánto puede pesar y en qué ruta va. Centralizarlo es lo que permite
 * que el cliente, el diseñador y la policy de storage estén de acuerdo
 * sobre dónde vive cada archivo.
 *
 * El bucket es PRIVADO. No existe getPublicUrl() en este módulo: un
 * escaneo intraoral es dato clínico y se sirve solo por signed URL de
 * vida corta.
 */

import type { DesignFileKind } from "./types";

export const DESIGN_BUCKET = "design-files";

/** 500 MB. Una arcada completa escaneada en alta resolución llega a rozarlo. */
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

/** Vida de las URLs firmadas: suficiente para bajar un STL grande, no para compartir. */
export const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Extensiones aceptadas por clase de archivo.
 *
 * Los formatos de escaneo llegan casi siempre como application/octet-stream,
 * así que la validación es por extensión y tamaño, no por MIME.
 */
export const ACCEPTED_EXTENSIONS: Record<DesignFileKind, string[]> = {
  // STL/PLY/OBJ: mallas. DCM: tomografía. 3OXZ/3SHAPE y ZIP: exports de escáner.
  input_scan: [".stl", ".ply", ".obj", ".dcm", ".zip", ".3oxz", ".dxd", ".xorder"],
  input_reference: [".jpg", ".jpeg", ".png", ".heic", ".pdf", ".webp"],
  output_design: [".stl", ".ply", ".obj", ".zip", ".3mf"],
  output_preview: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4"],
  annotation: [".jpg", ".jpeg", ".png", ".pdf", ".webp"],
};

/** Quién tiene permitido subir cada clase de archivo. */
export const UPLOADER_SIDE: Record<DesignFileKind, "client" | "studio" | "both"> = {
  input_scan: "client",
  input_reference: "client",
  output_design: "studio",
  output_preview: "studio",
  annotation: "both",
};

/** Clases que el cliente puede descargar (las demás son de uso interno). */
export const CLIENT_VISIBLE_KINDS: DesignFileKind[] = [
  "input_scan",
  "input_reference",
  "output_design",
  "output_preview",
  "annotation",
];

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot).toLowerCase();
}

export interface FileValidationResult {
  ok: boolean;
  /** Motivo del rechazo, listo para mostrar. Vacío si ok. */
  error?: string;
}

/** Valida un archivo antes de tocar la red. */
export function validateDesignFile(
  fileName: string,
  fileSize: number,
  kind: DesignFileKind,
): FileValidationResult {
  const ext = getExtension(fileName);
  if (!ext) {
    return { ok: false, error: "El archivo no tiene extensión." };
  }
  if (!ACCEPTED_EXTENSIONS[kind].includes(ext)) {
    return {
      ok: false,
      error: `Formato ${ext} no admitido. Se aceptan: ${ACCEPTED_EXTENSIONS[kind].join(", ")}.`,
    };
  }
  if (fileSize <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (fileSize > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `El archivo pesa ${formatBytes(fileSize)} y el máximo es ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }
  return { ok: true };
}

/**
 * Ruta dentro del bucket: {orderId}/{kind}/{version}-{nombre-limpio}
 *
 * El primer segmento es el UUID de la orden porque la policy de
 * storage.objects resuelve el permiso sobre él (storage.foldername(name)[1]).
 * Cambiar este formato rompe la RLS del bucket.
 */
export function buildStoragePath(
  orderId: string,
  kind: DesignFileKind,
  version: number,
  fileName: string,
): string {
  return `${orderId}/${kind}/${version}-${sanitizeFileName(fileName)}`;
}

/**
 * Deja el nombre en algo que Supabase Storage acepta sin sorpresas:
 * sin acentos, sin espacios, sin separadores de ruta.
 */
export function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos
    .replace(/[^\w.\-]+/g, "_")      // todo lo raro pasa a _
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "");          // sin punto/guión bajo inicial
  return normalized || "archivo";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}
