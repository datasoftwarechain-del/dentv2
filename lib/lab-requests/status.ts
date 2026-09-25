/** [040_lab_requests] Estados de una solicitud web y sus etiquetas. */

export type LabRequestStatus = "pending_review" | "converting" | "converted" | "rejected";
export type LabRequestFileStatus = "none" | "pending" | "uploaded";
export type LabRequestUrgency = "normal" | "urgent";

export const LAB_REQUEST_STATUS_LABELS: Record<LabRequestStatus, string> = {
  pending_review: "Pendiente",
  converting: "Convirtiendo…",
  converted: "Convertida",
  rejected: "Rechazada",
};

export const LAB_REQUEST_FILE_STATUS_LABELS: Record<LabRequestFileStatus, string> = {
  none: "Sin archivo",
  pending: "Archivo no llegó",
  uploaded: "Archivo recibido",
};

export function isOpenRequest(status: LabRequestStatus): boolean {
  return status === "pending_review";
}
