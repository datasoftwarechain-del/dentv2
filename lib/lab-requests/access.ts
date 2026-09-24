/**
 * [040_lab_requests] Quién puede ver y operar una solicitud web.
 *
 * Solo miembros del laboratorio receptor. La RLS de 040 ya filtra por
 * organización a nivel base; esta capa agrega el tipo de org (un
 * dentista o un estudio de diseño no tienen bandeja de solicitudes) y
 * los permisos de colaborador, que la RLS no distingue.
 */

import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import type { CollaboratorPermissions, PermissionKey } from "@/lib/permissions";
import type { LabRequest } from "./types";

export interface LabRequestAccess {
  userId: string;
  orgId: string;
  request: LabRequest;
  permissions: CollaboratorPermissions | null;
  isCollaborator: boolean;
}

export type LabRequestAccessResult =
  | { access: LabRequestAccess; error: null }
  | { access: null; error: { message: string; status: number } };

/**
 * Permiso de colaborador que exige cada acción. Los admins pasan siempre
 * (permissions === null).
 */
export const LAB_REQUEST_ACTION_PERMISSION: Record<"view" | "convert" | "reject", PermissionKey> = {
  view: "view_orders",
  convert: "create_orders",
  reject: "edit_orders",
};

export async function resolveLabRequestAccess(
  requestId: string,
  action: keyof typeof LAB_REQUEST_ACTION_PERMISSION,
): Promise<LabRequestAccessResult> {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "lab") {
    return { access: null, error: { message: "Solicitud no encontrada", status: 404 } };
  }
  if (isCollaborator && !permissions?.[LAB_REQUEST_ACTION_PERMISSION[action]]) {
    return { access: null, error: { message: "No autorizado", status: 403 } };
  }

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("lab_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) return { access: null, error: { message: error.message, status: 500 } };
  // RLS + maybeSingle: ajena e inexistente llegan igual, y se responde
  // igual. Decir "existe pero no es tuya" filtra información.
  if (!request || request.lab_org_id !== org.id) {
    return { access: null, error: { message: "Solicitud no encontrada", status: 404 } };
  }

  return {
    access: {
      userId: user.id,
      orgId: org.id,
      request: request as LabRequest,
      permissions,
      isCollaborator,
    },
    error: null,
  };
}
