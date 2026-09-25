/**
 * [040_lab_requests] Qué se puede pedir desde la landing de fresado e
 * impresión, y a qué se traduce del lado del laboratorio.
 *
 * Es el puente entre las cards (content/servicios.ts) y las tablas
 * reales: cada producto público apunta a UN ítem del catálogo del
 * laboratorio (por nombre exacto, que es lo único estable entre orgs)
 * y a UN work_type del enum de lab_order_items.
 *
 * El work_type es un valor por defecto: el laboratorio lo puede cambiar
 * al convertir la solicitud en orden. Lo que NO puede cambiar el
 * visitante es la lista: un product_key fuera de este mapa se rechaza
 * con 422 antes de tocar la base.
 */

export type LabProductBlock = "fresado" | "impresion";

/** Valores del enum work_type de 001_schema.sql. */
export type LabWorkType =
  | "corona_metal_ceramica"
  | "corona_zirconia"
  | "corona_emax"
  | "puente_fijo"
  | "protesis_removible"
  | "protesis_total"
  | "implante_corona"
  | "carilla"
  | "incrustacion"
  | "ferula"
  | "retenedor"
  | "reparacion"
  | "otro";

/** Lista cerrada para Zod y selects. Las etiquetas viven en lib/work-types.ts. */
export const LAB_WORK_TYPES: LabWorkType[] = [
  "corona_metal_ceramica", "corona_zirconia", "corona_emax", "puente_fijo",
  "protesis_removible", "protesis_total", "implante_corona", "carilla",
  "incrustacion", "ferula", "retenedor", "reparacion", "otro",
];

export interface LabProduct {
  key: string;
  label: string;
  block: LabProductBlock;
  /** Nombre EXACTO del ítem en price_catalog del laboratorio. */
  catalogName: string;
  /** Material que queda en lab_order_items.material. */
  material: string;
  /** work_type sugerido al convertir. El laboratorio puede cambiarlo. */
  defaultWorkType: LabWorkType;
  /** Si tiene sentido pedir piezas dentales (un modelo de estudio no). */
  asksTeeth: boolean;
  /** Si tiene sentido pedir color (un modelo o un STL ajeno no). */
  asksShade: boolean;
  /**
   * 'required' : sin archivo no se puede producir (fresado de un STL ajeno)
   * 'optional' : puede venir el STL, o el laboratorio lo escanea/diseña
   */
  file: "required" | "optional";
  /** Unidad para el texto de cantidad. */
  unit: string;
}

const P = (
  key: string, label: string, block: LabProductBlock, catalogName: string,
  material: string, defaultWorkType: LabWorkType,
  opts: Partial<Pick<LabProduct, "asksTeeth" | "asksShade" | "file" | "unit">> = {},
): LabProduct => ({
  key, label, block, catalogName, material, defaultWorkType,
  asksTeeth: opts.asksTeeth ?? true,
  asksShade: opts.asksShade ?? true,
  file: opts.file ?? "optional",
  unit: opts.unit ?? "pieza",
});

export const LAB_PRODUCTS: LabProduct[] = [
  // ─── 02 · Fresado CAM ────────────────────────────────────────
  P("zirconio",    "Zirconio",              "fresado", "Zirconio",                          "Zirconio",           "corona_zirconia"),
  P("zirconio-fx", "Zirconio FX",           "fresado", "ZIRCONIO FX",                       "Zirconio multicapa", "corona_zirconia"),
  P("disilicato",  "Disilicato de litio",   "fresado", "Disilicato de litio o Feldespato",  "Disilicato de litio","corona_emax"),
  P("pmma",        "PMMA / provisorios",    "fresado", "PMMA",                              "PMMA",               "otro"),
  P("fresado-stl", "Fresado de tu STL",     "fresado", "Fresado de STL",                    "A elección",         "otro",
    { file: "required" }),
  // ─── 03 · Impresión 3D ───────────────────────────────────────
  P("modelos",     "Modelos de trabajo y estudio", "impresion", "MODELOS IMPRESOS",         "Resina dental",      "otro",
    { asksTeeth: false, asksShade: false, unit: "modelo" }),
  P("provisorio-flex", "Provisorios impresos", "impresion", "PROVISORIO FLEX (Hasta 4 piezas)", "Resina flex",   "otro"),
];

const BY_KEY = new Map(LAB_PRODUCTS.map((p) => [p.key, p]));

export function getLabProduct(key: string | null | undefined): LabProduct | undefined {
  if (!key) return undefined;
  return BY_KEY.get(key);
}

export const LAB_PRODUCT_KEYS = LAB_PRODUCTS.map((p) => p.key);

export const LAB_BLOCK_LABELS: Record<LabProductBlock, string> = {
  fresado: "Fresado CAM",
  impresion: "Impresión 3D",
};
