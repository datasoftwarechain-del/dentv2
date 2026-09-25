import type { LabRequestFileStatus, LabRequestStatus, LabRequestUrgency } from "./status";

/** Fila de lab_requests (040). */
export interface LabRequest {
  id: string;
  request_number: string;
  lab_org_id: string;
  status: LabRequestStatus;

  professional_name: string;
  email: string;
  phone: string | null;
  clinic_name: string;
  country: string;
  department: string | null;
  city: string | null;
  address: string | null;

  product_key: string;
  catalog_name: string | null;
  catalog_item_id: string | null;
  material: string | null;
  quantity: number;
  tooth_positions: string[] | null;
  shade: string | null;
  urgency: LabRequestUrgency;
  patient_ref: string | null;
  notes: string | null;

  file_status: LabRequestFileStatus;
  file_name: string | null;
  file_size: number | null;
  storage_path: string | null;
  existing_case_ref: string | null;

  idempotency_key: string;
  source: string;
  accepted_terms_at: string;

  lab_order_id: string | null;
  dentist_org_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;

  created_at: string;
  updated_at: string;
}
