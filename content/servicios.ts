/**
 * Contenido de la sección "Servicios" de la landing.
 *
 * UNA SOLA FUENTE DE VERDAD PARA DISEÑO
 *   Las cards de Diseño digital NO se escriben acá: salen de
 *   lib/design/services.ts, que es el mismo catálogo que alimenta el
 *   desplegable del formulario, el precio y la línea de la factura. Si
 *   se agrega un servicio, aparece en la landing solo; si se cambia un
 *   texto, cambia en los dos lados. Acá solo se decide cómo se presenta.
 *
 * FRESADO E IMPRESIÓN: SOLO LO QUE EL LABORATORIO VENDE
 *   Cada card apunta por nombre a un arancel REAL de price_catalog del
 *   laboratorio. Los mockups traían "cera para colado", "guías
 *   quirúrgicas impresas" y "férulas impresas": no existen en el
 *   catálogo, así que no están. Publicar un servicio que no se puede
 *   pedir es peor que una card menos. Los que están en $0 en el catálogo
 *   se muestran como "a cotizar", nunca como $0.
 *
 * Los tiempos son ORIENTATIVOS. El brief del diseño lo dice explícito:
 * "confirmalos". Están acá para que se editen sin tocar componentes.
 */

import { DESIGN_SERVICES, type DesignService } from "@/lib/design/services";

export type Scope = "worldwide" | "uruguay";

export interface ServiceCardContent {
  /** Clave estable. Para Diseño es el service_code; para físico, un slug. */
  key: string;
  title: string;
  description: string;
  /** Texto del chip de tiempo, p. ej. "24–48 h" o "3–5 días". */
  time: string;
  /** Texto del chip de especificación, p. ej. "STL · PLY · OBJ". */
  spec: string;
  scope: Scope;
  cta: string;
  /** Imagen real bajo /public. null = placeholder rayado con `placeholder`. */
  image: string | null;
  /** Texto del placeholder cuando no hay imagen ("Render · corona"). */
  placeholder: string;
  /** A dónde lleva la card. */
  href: string;
  /**
   * Nombre EXACTO del arancel en price_catalog del laboratorio, para leer
   * el precio en vivo. Solo aplica a físico. null = no se muestra precio.
   */
  catalogName?: string | null;
}

export interface LocalBlock {
  number: string;
  key: "fresado" | "impresion";
  title: string;
  subtitle: string;
  items: ServiceCardContent[];
  /**
   * Oferta distinta a las cards (traé tu propio archivo): va como banner
   * ancho debajo de la grilla, no como quinta card huérfana.
   */
  banner?: ServiceCardContent;
}

// ─── Encabezado ───────────────────────────────────────────────

export const SERVICIOS_HEADER = {
  eyebrow: "Servicios",
  title: "Elegí cómo trabajar con nosotros.",
  subtitle: "Diseñamos, imprimimos y fresamos.",
  scopes: {
    worldwide: "Archivo digital",
    uruguay: "Pieza física, envío gratis en el país",
  },
} as const;

export const DESIGN_BLOCK = {
  number: "01",
  title: "Diseño digital",
  subtitle: "100% remoto. Subís tu escaneo en STL, PLY u OBJ y recibís el archivo de diseño listo para producir.",
  steps: ["Subís el escaneo", "Diseñamos", "Recibís el archivo"],
} as const;

// ─── Diseño: derivado del catálogo ────────────────────────────

/** Imagen real disponible para algunos servicios; el resto, placeholder. */
const DESIGN_IMAGES: Partial<Record<string, string>> = {
  crown_bridge: "/servicios/puente.png",
  complete_denture: "/servicios/arcada-completa.png",
  all_on_x: "/servicios/arcada-completa.png",
  onlay_inlay_veneer: "/servicios/molar.png",
};

function hoursLabel(h: number): string {
  if (h <= 24) return "24 h";
  if (h <= 48) return "24–48 h";
  if (h <= 72) return "48–72 h";
  return `${Math.round(h / 24)} días`;
}

function specLabel(s: DesignService): string {
  const parts = ["STL · PLY · OBJ"];
  if (s.requiredInputs.includes("photos")) parts.push("fotos");
  return parts.join(" · ");
}

export function designCards(): ServiceCardContent[] {
  return DESIGN_SERVICES.map((s) => ({
    key: s.code,
    title: s.label,
    description: s.description,
    time: hoursLabel(s.defaultTurnaroundHours),
    spec: specLabel(s),
    scope: "worldwide",
    cta: "Enviar caso",
    image: DESIGN_IMAGES[s.code] ?? null,
    placeholder: `Render · ${s.label.toLowerCase()}`,
    // El flujo público que ya existe, con el servicio preseleccionado.
    href: `/disenos/solicitar?servicio=${encodeURIComponent(s.code)}`,
  }));
}

// ─── Fresado e impresión: solo lo que el laboratorio vende ────

const U = (
  key: string, title: string, description: string, time: string, spec: string,
  catalogName: string | null, image: string | null, placeholder: string,
): ServiceCardContent => ({
  key, title, description, time, spec, catalogName, image, placeholder,
  scope: "uruguay",
  cta: "Cotizar",
  href: `/fresado/solicitar?producto=${encodeURIComponent(key)}`,
});

export const LOCAL_BLOCKS: LocalBlock[] = [
  {
    number: "02",
    key: "fresado",
    title: "Fresado CAM",
    subtitle: "Producción en nuestro laboratorio, con envío gratis a todo el país.",
    items: [
      U("zirconio", "Zirconio",
        "Monolítico, alta translucidez para anteriores y posteriores.",
        "3–5 días", "Monolítico", "Zirconio", null, "Foto · corona de zirconio"),
      U("zirconio-fx", "Zirconio FX",
        "Multicapa con gradiente natural, para estética en sector anterior.",
        "3–5 días", "Multicapa", "ZIRCONIO FX", null, "Foto · zirconio multicapa"),
      U("pmma", "PMMA / provisorios",
        "Provisorios de larga duración fresados en bloque, estables y pulidos.",
        "48 h", "PMMA", "PMMA", null, "Foto · provisorio PMMA"),
      U("pmma-protesis", "Prótesis PMMA fresada",
        "Prótesis fresada en disco de PMMA, en una sola pieza.",
        "3–5 días", "PMMA", "PROTESIS PMMA FRESADA", null, "Foto · prótesis PMMA fresada"),
      U("doe-fresada", "DOE fresada",
        "Dispositivo oclusal estabilizador fresado, de ajuste preciso.",
        "3–5 días", "PMMA", "DOE Fresada", null, "Foto · DOE fresada"),
    ],
    banner: U("fresado-stl", "¿Ya tenés el diseño? Fresamos tu STL",
      "Subís el archivo y lo fresamos en el material que elijas: zirconio, disilicato o PMMA.",
      "48–72 h", "STL · PLY · OBJ · 3MF", "Fresado de STL", null, "Foto · fresado CAM"),
  },
  {
    number: "03",
    key: "impresion",
    title: "Impresión 3D",
    subtitle: "Impresión en resinas dentales certificadas, lista para usar en clínica.",
    items: [
      U("modelos", "Modelos de trabajo y estudio",
        "Modelos con troqueles removibles y ajuste verificado.",
        "24–48 h", "Resina dental", "MODELOS IMPRESOS", null, "Foto · modelo impreso"),
      U("provisorio-flex", "Provisorios impresos",
        "Resina de alta resistencia para provisorios de corto y mediano plazo.",
        "24–48 h", "Hasta 4 piezas", "PROVISORIO FLEX (Hasta 4 piezas)", null, "Foto · provisorio impreso"),
      U("mockups", "Mockups",
        "Prueba estética para que el paciente vea el resultado antes de tallar.",
        "24–48 h", "Resina dental", "MOCKUP IMPRESO", null, "Foto · mockup impreso"),
      U("doe-impresa", "DOE impresa",
        "Dispositivo oclusal estabilizador impreso en resina rígida.",
        "24–48 h", "Resina dental", "DOE Impresa", null, "Foto · DOE impresa"),
      U("ceramica-impresa", "Restauraciones en cerámica impresa",
        "Coronas e incrustaciones impresas en resina cerámica.",
        "24–48 h", "Resina cerámica", "CERAMICA IMPRESA", null, "Foto · restauración cerámica impresa"),
      U("ppr-3d-flex", "Prótesis 3D Flex",
        "Parcial removible flexible, impresa en 3D.",
        "24–48 h", "Resina flex", "PPR 3D FLEX", null, "Foto · prótesis 3D Flex"),
      U("completa-3d", "Prótesis completas 3D",
        "Prótesis completa impresa, base y dientes en resina dental.",
        "24–48 h", "Resina dental", "PROTESIS COMPLETA 3D", null, "Foto · prótesis completa 3D"),
    ],
  },
];

export const LOCAL_FOOTNOTE = "Próximamente en más países";

/** Encabezado de la lista compacta del catálogo de diseño (bajo el coverflow). */
export const DESIGN_LIST = {
  title: "Los 12 servicios, de un vistazo",
  hint: "Plazo desde que el caso queda pago · Precio por unidad, según piezas y revisiones",
} as const;

/** Aviso de alcance que ve un profesional fuera de Uruguay al cotizar. */
export const OUT_OF_SCOPE_MESSAGE = {
  title: "Por ahora fresamos e imprimimos solo en Uruguay",
  body: "Podemos diseñar tu caso de todos modos: subís el escaneo y recibís el archivo listo para producir en tu laboratorio de confianza.",
  cta: "Ver diseño digital",
  href: "/disenos/solicitar",
} as const;

/**
 * Cierre de la sección: el abanico "Subí tu escaneo. Recibí el diseño."
 * del lienzo claro del export. Seis servicios destacados sobre un arco,
 * con un panel que describe el elegido y manda al flujo de solicitud.
 * `featured` son códigos de DESIGN_SERVICES, en el orden del arco
 * (de izquierda a derecha).
 */
export const DESIGN_ARC = {
  badge: "Online · 100% remoto",
  kicker: "Diseño digital",
  title: ["Subí tu escaneo.", "Recibí el diseño."],
  featured: [
    "crown_bridge",
    "onlay_inlay_veneer",
    "custom_abutment",
    "all_on_x",
    "night_guard_splint",
    "smile_design_waxup",
  ],
} as const;
