/**
 * Shared TypeScript types for the DigitalDent v2 application.
 * These types correspond to the Supabase database schema.
 */

export interface Organization {
  id: string;
  name: string;
  type: "dentist" | "lab" | "dentist_preview";
  phone: string | null;
  address: string | null;
  is_system_account: boolean;
}

export interface OrgMembership {
  organization: Organization | Organization[];
  role?: string;
  user_id?: string;
}

/**
 * A member of an organization.
 * Admins have role='admin' and empty permissions ({}).
 * Collaborators have role='collaborator' and explicit permissions.
 */
export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  role: "admin" | "member" | "collaborator";
  permissions: Record<string, boolean>;
  status: "active" | "suspended";
  display_name: string | null;
  invited_by: string | null;
  created_at: string;
  /** Joined from auth.users — only present when queried via admin API */
  email?: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  dentist_org_id: string;
  created_at: string;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_org_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export type OrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "delivered"
  | "cancelled";

export interface LabOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  dentist_org_id: string;
  lab_org_id: string;
  due_date: string | null;
  patient_name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    first_name?: string;
    last_name?: string;
    [key: string]: unknown;
  };
}

/**
 * Lab→dentist invoice (table: invoices).
 *
 * State machine on totals/edit:
 *   totals_strict=false                          → historical, read-only on amounts.
 *   totals_strict=true,  manually_overridden=false → live, recalculated from items.
 *   totals_strict=true,  manually_overridden=true  → live, persisted is truth (manual override).
 */
export interface Invoice {
  id: string;
  invoice_number: string;
  lab_org_id: string;
  dentist_org_id: string;
  order_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  work_type: string | null;
  delivery_date: string | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string | null;
  notes: string | null;
  totals_strict: boolean;
  manually_overridden: boolean;
  invoice_voided_at: string | null;
  /**
   * [031_invoice_discounts] Descuento persistido como dato real.
   * type=NULL ⇒ sin descuento. Si type='percent' o 'amount', value es lo
   * tipeado por el usuario (10% o $500) y amount es el monto resuelto en
   * pesos. Invariante: total = subtotal − discount_amount + tax_amount.
   */
  discount_type: "percent" | "amount" | null;
  discount_value: number | null;
  discount_amount: number;
  created_at: string;
  updated_at: string | null;
}
