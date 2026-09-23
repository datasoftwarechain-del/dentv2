/**
 * [035_design_studio] Compuerta de envío de una orden de diseño.
 *
 * El costo real del negocio no es diseñar: es el ida y vuelta por casos
 * que llegaron incompletos. Una orden que entra sin antagonista o sin
 * mordida se va a frenar en `needs_info` y va a consumir dos mensajes y
 * un día de plazo. Esta validación es el filtro que evita eso ANTES de
 * que la orden salga del lado del cliente.
 *
 * Distingue dos cosas a propósito:
 *   - errors:   bloquean el envío. Sin esto no se puede diseñar.
 *   - warnings: no bloquean. Son el recordatorio de lo que suele faltar,
 *               porque un .zip del escáner puede traer todo adentro y no
 *               hay forma de saberlo sin abrirlo.
 */

import { getDesignService, REQUIRED_INPUT_LABELS } from "./services";
import type { DesignOrderItem, DesignOrderFile } from "./types";

export interface DesignOrderValidation {
  /** true = se puede enviar (no hay errores bloqueantes). */
  canSubmit: boolean;
  errors: string[];
  warnings: string[];
}

/** Lo mínimo que hace falta de un ítem para poder validarlo. */
export type ValidatableItem = Pick<
  DesignOrderItem,
  "service_code" | "tooth_positions" | "arch" | "quantity"
>;

/** Lo mínimo que hace falta de un archivo para poder validarlo. */
export type ValidatableFile = Pick<DesignOrderFile, "kind">;

export function validateDesignOrderForSubmit(
  items: ValidatableItem[] | null | undefined,
  files: ValidatableFile[] | null | undefined,
): DesignOrderValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const list = Array.isArray(items) ? items : [];
  const fileList = Array.isArray(files) ? files : [];

  if (list.length === 0) {
    errors.push("Agregá al menos un servicio de diseño a la orden.");
  }

  // ─── Cada ítem, contra lo que su servicio exige ───────────────
  const requiredInputs = new Set<string>();

  list.forEach((item, index) => {
    const position = `Servicio ${index + 1}`;
    const service = getDesignService(item.service_code);

    if (!service) {
      errors.push(`${position}: el servicio "${item.service_code}" no existe en el catálogo.`);
      return;
    }

    const label = `${position} (${service.label})`;

    if (service.requiresTeeth && (item.tooth_positions?.length ?? 0) === 0) {
      errors.push(`${label}: indicá al menos una pieza dentaria.`);
    }
    if (service.requiresArch && !item.arch) {
      errors.push(`${label}: indicá la arcada (superior, inferior o ambas).`);
    }
    if (!Number.isFinite(item.quantity) || item.quantity < 1) {
      errors.push(`${label}: la cantidad tiene que ser 1 o más.`);
    }

    service.requiredInputs.forEach((input) => requiredInputs.add(input));
  });

  // ─── Archivos ─────────────────────────────────────────────────
  // Bloqueante: sin un solo escaneo no hay nada que diseñar.
  const scanCount = fileList.filter((f) => f.kind === "input_scan").length;
  if (scanCount === 0) {
    errors.push("Subí al menos un escaneo intraoral (.stl, .ply, .dcm o el .zip del escáner).");
  }

  // No bloqueante: el checklist de lo que el caso normalmente necesita.
  // No podemos verificarlo archivo por archivo — un .zip puede traer todo.
  if (scanCount > 0 && requiredInputs.size > 0) {
    const pending = Array.from(requiredInputs)
      .map((k) => REQUIRED_INPUT_LABELS[k as keyof typeof REQUIRED_INPUT_LABELS])
      .filter(Boolean);
    if (pending.length > 0) {
      warnings.push(
        `Verificá que los archivos incluyan: ${pending.join(", ")}. Si falta algo, el caso vuelve como "Faltan datos".`,
      );
    }
  }

  return { canSubmit: errors.length === 0, errors, warnings };
}
