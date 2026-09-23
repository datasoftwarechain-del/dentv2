/**
 * [035_design_studio] Quién es quién frente a una orden de diseño.
 *
 * Toda ruta del módulo pasa por acá antes de tocar nada. Devuelve de qué
 * lado del mostrador está el usuario, que es lo que después decide qué
 * transiciones puede hacer (`canTransition`), qué archivos puede subir
 * y si ve las notas internas.
 *
 * La RLS de 035 ya filtra por organización a nivel base de datos. Esta
 * capa no la reemplaza: traduce "tengo acceso" en "soy el cliente" o
 * "soy el estudio", que la RLS sola no distingue.
 */

import { createClient } from "@/lib/supabase/server";
import { getUserOrg } from "@/lib/get-user-org";
import type { CollaboratorPermissions, PermissionKey } from "@/lib/permissions";
import type { ActorSide } from "./status";
import type { DesignOrder } from "./types";

export interface DesignAccess {
  userId: string;
  orgId: string;
  /** 'client' si la org pidió el diseño, 'studio' si lo ejecuta. */
  side: Exclude<ActorSide, "system">;
  order: DesignOrder;
  /** Modo de pago acordado con este cliente. Decide si el STL se retiene. */
  paymentMode: "account" | "prepaid";
  /** null = admin con acceso total. Colaborador = flags explícitos. */
  permissions: CollaboratorPermissions | null;
  isCollaborator: boolean;
}

export type DesignAccessResult =
  | { access: DesignAccess; error: null }
  | { access: null; error: { message: string; status: number } };

/**
 * Resuelve el acceso a una orden concreta.
 *
 * No confía en el `side` que mande el cliente: lo deriva comparando la
 * org del usuario contra studio_org_id / client_org_id de la orden.
 */
export async function resolveDesignAccess(orderId: string): Promise<DesignAccessResult> {
  const { user, org, isCollaborator, permissions } = await getUserOrg();

  if (isCollaborator && !permissions?.view_design_studio) {
    return { access: null, error: { message: "No autorizado", status: 403 } };
  }

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("design_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    return { access: null, error: { message: error.message, status: 500 } };
  }
  // maybeSingle() + RLS: una orden ajena llega como null, igual que una
  // inexistente. Respondemos 404 en los dos casos a propósito — decir
  // "existe pero no es tuya" filtra información.
  if (!order) {
    return { access: null, error: { message: "Orden no encontrada", status: 404 } };
  }

  let side: DesignAccess["side"];
  if (order.studio_org_id === org.id) {
    side = "studio";
  } else if (order.client_org_id === org.id) {
    side = "client";
  } else {
    return { access: null, error: { message: "Orden no encontrada", status: 404 } };
  }

  const { data: relation } = await supabase
    .from("design_studio_clients")
    .select("payment_mode, status")
    .eq("studio_org_id", order.studio_org_id)
    .eq("client_org_id", order.client_org_id)
    .maybeSingle();

  if (relation?.status === "suspended" && side === "client") {
    return { access: null, error: { message: "Tu cuenta con el estudio está suspendida", status: 403 } };
  }

  return {
    access: {
      userId: user.id,
      orgId: org.id,
      side,
      order: order as DesignOrder,
      paymentMode: (relation?.payment_mode as "account" | "prepaid") ?? "account",
      permissions,
      isCollaborator,
    },
    error: null,
  };
}

/**
 * Exige un permiso fino, o devuelve el error listo para responder.
 *
 * `resolveDesignAccess` solo verifica que el usuario pueda VER el módulo.
 * Sin esto, un colaborador de solo lectura podía asignar diseñadores,
 * aprobar en nombre del cliente y subir STL: los permisos existían en el
 * JSONB y en el diálogo de colaboradores, pero ninguna ruta los miraba.
 */
export function requireDesignPermission(
  access: DesignAccess,
  key: PermissionKey,
): { message: string; status: number } | null {
  if (hasDesignPermission(access.permissions, access.isCollaborator, key)) return null;
  return {
    message: `Tu cuenta no tiene el permiso "${key}". Pedíselo al administrador.`,
    status: 403,
  };
}

/**
 * Qué permiso necesita cada lado para actuar sobre una orden.
 *
 *   studio → manage_design_queue  (mover, asignar, aprobar por el cliente)
 *   client → create_design_orders (enviar, aprobar, pedir cambios, cancelar)
 */
export function actionPermissionFor(side: "studio" | "client"): PermissionKey {
  return side === "studio" ? "manage_design_queue" : "create_design_orders";
}

/**
 * ¿Tiene el usuario este permiso?
 *
 * Los admins (permissions === null) pasan siempre; los colaboradores
 * necesitan el flag explícito. Misma regla que hasPermission() de
 * lib/permissions.ts, repetida acá para no arrastrar la dependencia.
 */
export function hasDesignPermission(
  permissions: CollaboratorPermissions | null,
  isCollaborator: boolean,
  key: PermissionKey,
): boolean {
  if (!isCollaborator) return true;
  return !!permissions?.[key];
}

/** Oculta del payload lo que el cliente no debe ver. */
export function redactForClient<T extends { internal_notes?: string | null }>(
  order: T,
  side: ActorSide,
): T {
  if (side === "studio") return order;
  return { ...order, internal_notes: null };
}
