/**
 * [035_design_studio] Catálogo de servicios del Estudio de Diseño Digital.
 *
 * Es la lista que el cliente ve en el desplegable al crear una orden.
 * Los precios NO viven acá: viven en price_catalog (categoría
 * "Diseño Digital", columna design_service_code), para que cada estudio
 * fije los suyos y sigan funcionando los overrides por cliente (028) y
 * el margen por unit_cost (033).
 *
 * Lo que sí vive acá es lo que NO cambia entre estudios: qué unidad se
 * cobra, qué datos clínicos hacen falta para poder diseñar y qué
 * archivos tiene que subir el cliente. Eso es lo que evita que entre
 * una orden imposible de trabajar.
 */

/** Unidad sobre la que se cobra el servicio. */
export type BillingUnit = "unit" | "tooth" | "arch" | "case";

/** Archivos que el cliente tiene que adjuntar para que el caso sea trabajable. */
export type RequiredInput = "scan_upper" | "scan_lower" | "scan_bite" | "photos" | "scan_body";

export interface DesignService {
  /** Código estable. Es lo que se guarda en design_order_items.service_code. */
  code: string;
  /** Nombre comercial en español (el que ve el cliente local). */
  label: string;
  /** Nombre en inglés, tal como figura en la lista de servicios publicada. */
  labelEn: string;
  category: "restaurador" | "implantes" | "removible" | "otros";
  billingUnit: BillingUnit;
  /** Si es true, el formulario exige elegir piezas dentarias. */
  requiresTeeth: boolean;
  /** Si es true, el formulario exige elegir arcada (superior/inferior/ambas). */
  requiresArch: boolean;
  /** Plazo de referencia. El real se resuelve contra price_catalog / el acuerdo con el cliente. */
  defaultTurnaroundHours: number;
  /** Revisiones sin cargo incluidas por defecto. */
  includedRevisions: number;
  requiredInputs: RequiredInput[];
  /** Qué hace el servicio, en una línea, para el desplegable. */
  description: string;
}

export const DESIGN_SERVICES: DesignService[] = [
  {
    code: "model_design",
    label: "Diseño de Modelo",
    labelEn: "Model Design",
    category: "otros",
    billingUnit: "arch",
    requiresTeeth: false,
    requiresArch: true,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_body"],
    description: "Modelo imprimible a partir del escaneo, con o sin troqueles.",
  },
  {
    code: "crown_bridge",
    label: "Corona y Puente · Corona sobre Implante",
    labelEn: "Crown & Bridge | Implant Crown Design",
    category: "restaurador",
    billingUnit: "unit",
    requiresTeeth: true,
    requiresArch: false,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Corona unitaria, puente o corona atornillada/cementada sobre implante.",
  },
  {
    code: "onlay_inlay_veneer",
    label: "Onlay / Inlay / Carilla",
    labelEn: "Onlays/Inlays/Veneer",
    category: "restaurador",
    billingUnit: "unit",
    requiresTeeth: true,
    requiresArch: false,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Restauración parcial adherida: incrustaciones y carillas.",
  },
  {
    code: "smile_design_waxup",
    label: "Diseño de Sonrisa · Encerado Digital",
    labelEn: "Smile Design Wax Up with FREE Designed Model",
    category: "restaurador",
    billingUnit: "case",
    requiresTeeth: true,
    requiresArch: false,
    defaultTurnaroundHours: 48,
    includedRevisions: 3, // el diseño estético siempre va y vuelve más
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite", "photos"],
    description: "Encerado diagnóstico para mock-up. Incluye el modelo diseñado sin cargo.",
  },
  {
    code: "screw_retained_crown",
    label: "Corona Atornillada",
    labelEn: "Screw-Retained Crown",
    category: "implantes",
    billingUnit: "unit",
    requiresTeeth: true,
    requiresArch: false,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Corona sobre implante con acceso oclusal, sin pilar intermedio.",
  },
  {
    code: "custom_abutment",
    label: "Pilar Personalizado sobre Implante",
    labelEn: "Implant Custom Abutment design",
    category: "implantes",
    billingUnit: "unit",
    requiresTeeth: true,
    requiresArch: false,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Pilar anatómico individualizado para perfil de emergencia.",
  },
  {
    code: "partial_framework",
    label: "Estructura de Prótesis Parcial",
    labelEn: "Partial Denture Framework",
    category: "removible",
    billingUnit: "arch",
    requiresTeeth: false,
    requiresArch: true,
    defaultTurnaroundHours: 48,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Esqueleto metálico con retenedores, conectores y rejillas.",
  },
  {
    code: "acrylic_flipper",
    label: "Prótesis Parcial Acrílica (Flipper)",
    labelEn: "Acrylic Partial Denture (Flipper) - unit",
    category: "removible",
    billingUnit: "unit",
    requiresTeeth: true,
    requiresArch: false,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Provisorio removible acrílico. Se cobra por pieza repuesta.",
  },
  {
    code: "impression_tray",
    label: "Cubeta Individual",
    labelEn: "Customized Impression Tray Design",
    category: "otros",
    billingUnit: "arch",
    requiresTeeth: false,
    requiresArch: true,
    defaultTurnaroundHours: 24,
    includedRevisions: 1, // es un caso simple: no debería necesitar vueltas
    requiredInputs: ["scan_body"],
    description: "Cubeta a medida para impresión definitiva.",
  },
  {
    code: "night_guard_splint",
    label: "Férula de Descarga / Protector Bucal",
    labelEn: "Night Guard / Mouthguard / Splint Design",
    category: "otros",
    billingUnit: "arch",
    requiresTeeth: false,
    requiresArch: true,
    defaultTurnaroundHours: 24,
    includedRevisions: 2,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite"],
    description: "Férula miorrelajante, protector deportivo o placa de reposicionamiento.",
  },
  {
    code: "complete_denture",
    label: "Prótesis Completa / Arcada Total",
    labelEn: "Complete Denture, Full Denture/Arch",
    category: "removible",
    billingUnit: "arch",
    requiresTeeth: false,
    requiresArch: true,
    defaultTurnaroundHours: 72,
    includedRevisions: 3,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite", "photos"],
    description: "Prótesis total mucosoportada, con montaje dentario digital.",
  },
  {
    code: "all_on_x",
    label: "All-on-X / Arcada sobre Implantes",
    labelEn: "All-on-X / Arch",
    category: "implantes",
    billingUnit: "arch",
    requiresTeeth: false,
    requiresArch: true,
    defaultTurnaroundHours: 72,
    includedRevisions: 3,
    requiredInputs: ["scan_upper", "scan_lower", "scan_bite", "photos"],
    description: "Rehabilitación de arcada completa sobre múltiples implantes.",
  },
];

/**
 * [035_design_studio] Código del cargo por revisión fuera de las incluidas.
 *
 * No es un servicio del desplegable: el cliente nunca lo pide. Lo genera
 * el sistema como línea aparte cuando se piden más vueltas de las que el
 * servicio incluye, y vive en price_catalog como cualquier otro arancel
 * para que el estudio le ponga precio desde Ajustes.
 *
 * Si el estudio NO lo cargó, no se cobra nada y queda una nota interna en
 * la bitácora. Antes inventar un precio que facturar de más sin aviso.
 */
export const REVISION_FEE_CODE = "revision_fee";

export const REVISION_FEE_LABEL = "Revisión adicional";

/** Índice por código, para no recorrer el array en cada render. */
const SERVICE_BY_CODE = new Map(DESIGN_SERVICES.map((s) => [s.code, s]));

export function getDesignService(code: string | null | undefined): DesignService | undefined {
  if (!code) return undefined;
  return SERVICE_BY_CODE.get(code);
}

/** Etiqueta legible para facturas, listados y export. Cae al código si no se reconoce. */
export function getDesignServiceLabel(code: string | null | undefined): string {
  if (!code) return "(sin servicio)";
  if (code === REVISION_FEE_CODE) return REVISION_FEE_LABEL;
  return SERVICE_BY_CODE.get(code)?.label ?? code;
}

/**
 * Revisiones sin cargo de una orden completa.
 *
 * Se toma el servicio MÁS GENEROSO de la orden, no el más estricto: si
 * alguien pide un All-on-X (3 incluidas) junto con una cubeta (1), cobrarle
 * la segunda vuelta porque la cubeta ya se pasó sería una sorpresa
 * desagradable en la factura de un trabajo que era mayormente el All-on-X.
 *
 * El cargo por revisión (`revision_fee`) no cuenta: no es un servicio
 * pedido, es la consecuencia de haberse pasado.
 */
export function includedRevisionsForOrder(serviceCodes: string[]): number {
  const relevant = serviceCodes.filter((code) => code !== REVISION_FEE_CODE);
  if (relevant.length === 0) return DEFAULT_INCLUDED_REVISIONS;

  return Math.max(
    ...relevant.map(
      (code) => SERVICE_BY_CODE.get(code)?.includedRevisions ?? DEFAULT_INCLUDED_REVISIONS,
    ),
  );
}

/** Lo que se asume para un código que el catálogo no reconoce. */
export const DEFAULT_INCLUDED_REVISIONS = 2;

export const DESIGN_SERVICE_CATEGORY_LABELS: Record<DesignService["category"], string> = {
  restaurador: "Restaurador",
  implantes: "Implantes",
  removible: "Removible",
  otros: "Otros",
};

export const REQUIRED_INPUT_LABELS: Record<RequiredInput, string> = {
  scan_upper: "Escaneo maxilar superior",
  scan_lower: "Escaneo maxilar inferior",
  scan_bite: "Registro de mordida",
  scan_body: "Escaneo de la arcada",
  photos: "Fotografías clínicas",
};

/** Servicios agrupados por categoría, en el orden en que se muestran. */
export function groupServicesByCategory(): Array<{
  category: DesignService["category"];
  label: string;
  services: DesignService[];
}> {
  const order: DesignService["category"][] = ["restaurador", "implantes", "removible", "otros"];
  return order
    .map((category) => ({
      category,
      label: DESIGN_SERVICE_CATEGORY_LABELS[category],
      services: DESIGN_SERVICES.filter((s) => s.category === category),
    }))
    .filter((g) => g.services.length > 0);
}
