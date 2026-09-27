/**
 * [042_designers] Tipos de la postulación de diseñadores.
 *
 * El diseñador NO es un usuario de la app en esta etapa: es una fila
 * aprobada que sirve de destinatario para el envío de casos por correo.
 * Cuando el reparto se automatice, el bot lee esta misma tabla.
 */

export type DesignApplicationStatus = "pending_review" | "approved" | "rejected";

export interface DesignApplication {
  id: string;
  application_number: string;
  studio_org_id: string;
  status: DesignApplicationStatus;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  city: string | null;
  years_experience: number | null;
  software: string[] | null;
  specialties: string[] | null;
  portfolio_url: string | null;
  notes: string | null;
  source: string;
  accepted_terms_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const APPLICATION_STATUS_LABEL: Record<DesignApplicationStatus, string> = {
  pending_review: "Pendientes",
  approved: "Aprobados",
  rejected: "Rechazados",
};
