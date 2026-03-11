/**
 * Tipos de arancel para prótesis completas.
 * Estas opciones se representan como extras en price_catalog.extras (JSONB).
 * El ArancelSelector las muestra como radio buttons en el formulario de órdenes.
 */

export type ArancelType =
  | "simple"
  | "plus_terminaciones"      // +2 terminaciones
  | "plus_completas"          // +2 completas
  | "cubeta_individual"       // cubeta individual
  | "protesis_completa_pack"  // pack: +2 terminaciones +2 completas + cubeta

export interface ArancelOption {
  type: ArancelType;
  label: string;
  description: string;
  /** Precio adicional sobre el base_price del item del catálogo */
  priceModifier: number;
  category: "protesis_completa" | "protesis_parcial" | "otro";
}

export const ARANCEL_OPTIONS: ArancelOption[] = [
  {
    type: "simple",
    label: "Simple",
    description: "Sin extras adicionales",
    priceModifier: 0,
    category: "protesis_completa",
  },
  {
    type: "plus_terminaciones",
    label: "+2 Terminaciones",
    description: "Dos terminaciones adicionales incluidas",
    priceModifier: 0,
    category: "protesis_completa",
  },
  {
    type: "plus_completas",
    label: "+2 Completas",
    description: "Dos piezas completas adicionales",
    priceModifier: 0,
    category: "protesis_completa",
  },
  {
    type: "cubeta_individual",
    label: "Cubeta Individual",
    description: "Cubeta individual personalizada",
    priceModifier: 0,
    category: "protesis_completa",
  },
  {
    type: "protesis_completa_pack",
    label: "Pack Prótesis Completa",
    description: "+2 Terminaciones + 2 Completas + Cubeta Individual",
    priceModifier: 0,
    category: "protesis_completa",
  },
];

/** Etiquetas legibles para mostrar en facturas y detalles */
export const ARANCEL_LABELS: Record<ArancelType, string> = {
  simple:                 "Simple",
  plus_terminaciones:     "+2 Terminaciones",
  plus_completas:         "+2 Completas",
  cubeta_individual:      "Cubeta Individual",
  protesis_completa_pack: "Pack Prótesis Completa",
};

export function getArancelLabel(type: string | null | undefined): string {
  if (!type) return "";
  return ARANCEL_LABELS[type as ArancelType] ?? type;
}
