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
