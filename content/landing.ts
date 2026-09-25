/**
 * Copy de la landing (fuera de la sección Servicios, que tiene el suyo en
 * content/servicios.ts).
 *
 * Posicionamiento: DigitalDent es una PLATAFORMA DE ODONTOLOGÍA DIGITAL con
 * tres caminos bajo una sola promesa — diseño online, producción en
 * Uruguay y software para gestionarlo. El visitante elige el suyo en el
 * primer scroll en vez de adivinar si la página es para él.
 *
 * Reglas del copy:
 *   - Nada que no exista o no se pueda probar (sin "líder", sin cifras
 *     inventadas: las de STATS salen de la base en cada render).
 *   - Voseo, frases cortas, un verbo por CTA y cada CTA dice a dónde va.
 *   - Fresado e impresión nunca con precio público; diseño como "Desde".
 */

export const NAV = [
  { label: "Servicios", href: "#servicios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Precios", href: "#precios" },
  { label: "Preguntas", href: "#faq" },
] as const;

export const HERO = {
  kicker: "Plataforma de odontología digital · Montevideo",
  title: ["Del escaneo a la pieza terminada,", "sin vueltas."],
  subtitle:
    "Subís el escaneo intraoral y recibís el diseño STL en 24–72 h, desde cualquier país. En Uruguay también lo fresamos e imprimimos. Y si querés ordenar tu clínica o laboratorio, la plataforma lo hace por US$ 49 al mes.",
  primary: { label: "Pedir un diseño", href: "/disenos/solicitar" },
  secondary: { label: "Conocer la plataforma", href: "#plataforma" },
  tertiary: { label: "¿Estás en Uruguay? Cotizá fresado e impresión", href: "/fresado/solicitar" },
  trust: ["Sin cuenta previa para pedir", "Pagás antes de que diseñemos, sin sorpresas", "Sin datos del paciente: solo un código"],
} as const;

/** Los tres caminos, en el orden en que generan ingresos hoy. */
export const PILLARS = [
  {
    key: "diseno",
    scope: "online",
    title: "Diseño CAD online",
    text: "Coronas, puentes, implantes, férulas, prótesis y All-on-X. Subís el escaneo, recibís el STL.",
    cta: "Ver los 12 servicios",
    href: "#servicios",
  },
  {
    key: "produccion",
    scope: "uruguay",
    title: "Fresado e impresión en Uruguay",
    text: "Zirconio, disilicato, PMMA, modelos y provisorios, producidos en nuestro laboratorio con envío gratis en el país.",
    cta: "Cotizar un trabajo",
    href: "/fresado/solicitar",
  },
  {
    key: "plataforma",
    scope: "online",
    title: "Plataforma para clínicas y laboratorios",
    text: "Órdenes con archivos, Kanban de producción, facturación automática y permisos por colaborador.",
    cta: "Ver la plataforma",
    href: "#plataforma",
  },
] as const;

export const HOW_IT_WORKS = {
  eyebrow: "Cómo funciona",
  title: "Tres pasos, sea diseño, fresado o gestión.",
  subtitle: "Sin instalaciones ni capacitaciones. El mismo flujo para un caso suelto o para operar toda la clínica.",
  steps: [
    {
      number: "01",
      title: "Subís",
      text: "STL, PLY, OBJ o el .zip que exporta tu escáner. Para pedir no hace falta registrarse: con tu email alcanza.",
    },
    {
      number: "02",
      title: "Hacemos",
      text: "Diseñamos en CAD y te mandamos una previsualización. Si es fresado o impresión, producimos en Montevideo.",
    },
    {
      number: "03",
      title: "Recibís",
      text: "El STL listo para fresar o imprimir donde quieras, o la pieza en tu consultorio con envío gratis en Uruguay.",
    },
  ],
} as const;

export const PLATFORM = {
  eyebrow: "La plataforma",
  title: "Todo lo que pasa con un caso, en un solo lugar.",
  subtitle:
    "Es el mismo sistema con el que operamos nuestro laboratorio. Para clínicas, consultorios y laboratorios que quieren dejar de perseguir trabajos por WhatsApp.",
  benefits: [
    {
      icon: "ClipboardCheck",
      title: "Menos errores en las órdenes",
      text: "Especificación completa, piezas, color y archivos adjuntos en cada pedido. Se acabaron las fotos por WhatsApp y las llamadas para confirmar.",
    },
    {
      icon: "KanbanSquare",
      title: "Sabés en qué estado está cada trabajo",
      text: "Tablero de producción por etapas y estado visible para el cliente. Nadie tiene que preguntar \"¿cómo viene lo mío?\".",
    },
    {
      icon: "Receipt",
      title: "Cobrás lo que trabajaste",
      text: "Cada orden cerrada genera su factura con el detalle de ítems. Cuenta corriente por cliente y pendientes de cobro a la vista.",
    },
    {
      icon: "Users",
      title: "Tu equipo, con permisos",
      text: "Colaboradores que ven solo lo que les toca: recepción sin precios, técnicos sin facturación. Vos decidís.",
    },
  ],
} as const;

export const STATS_LABELS = {
  orders: "trabajos de laboratorio gestionados",
  clinics: "clínicas y consultorios activos",
  services: "servicios de diseño CAD",
  turnaround: "de entrega en diseño",
} as const;

export const PRICING_INTRO = {
  eyebrow: "Precios",
  title: "Pagás por caso o por plataforma. Nunca por los dos sin querer.",
  services: "Diseño CAD desde US$ 6 por unidad · Fresado e impresión en Uruguay, a cotizar por solicitud.",
  servicesCta: { label: "Ver servicios y precios", href: "#servicios" },
} as const;

export const FAQ = {
  eyebrow: "Preguntas frecuentes",
  title: "Lo que nos preguntan antes de mandar el primer caso.",
  items: [
    {
      q: "¿Qué archivos aceptan?",
      a: "Para diseño: STL, PLY, OBJ, DCM y el .zip o export nativo de tu escáner (3OXZ, DXD, XORDER). Para fresado de un STL propio: STL, PLY, OBJ, 3MF o un ZIP. Hasta 500 MB por archivo en diseño y 200 MB en fresado.",
    },
    {
      q: "¿Cuánto tarda un diseño?",
      a: "Entre 24 y 72 h según el servicio: un modelo o una corona unitaria, 24 h; una arcada sobre implantes o una prótesis completa, hasta 72 h. El plazo de cada servicio está en su card y corre desde que el caso queda pago y con los archivos completos.",
    },
    {
      q: "¿Cómo y cuándo pago?",
      a: "Al enviar el caso se genera la factura y el diseño entra a la cola cuando está paga. Hoy se paga por transferencia y el estudio confirma el pago; el STL final se descarga con la factura al día.",
    },
    {
      q: "¿Diseñan para fuera de Uruguay?",
      a: "Sí: el diseño es 100 % online y el archivo llega a cualquier país. Fresado e impresión, en cambio, solo en Uruguay, con envío gratis; si estás en otro país, te diseñamos el caso para que lo produzca tu laboratorio de confianza.",
    },
    {
      q: "¿Tengo que crear una cuenta para pedir?",
      a: "No. Elegís el servicio, dejás tu email y subís los archivos. El acceso se crea solo al enviar, para que puedas ver el avance, aprobar la previsualización y descargar el STL.",
    },
    {
      q: "¿Incluye revisiones?",
      a: "Cada servicio incluye una cantidad de revisiones (entre una y tres, según el servicio). Si necesitás más, se cobra una revisión adicional y se te avisa antes de hacerla.",
    },
    {
      q: "¿Qué pasa con los datos del paciente?",
      a: "No pedimos nombre ni documento: solo un código de referencia interno tuyo. Los escaneos se guardan en almacenamiento privado, se sirven por enlaces firmados de corta duración y solo los ve el equipo que trabaja tu caso.",
    },
    {
      q: "¿Puedo pedir varios servicios en la misma orden?",
      a: "En diseño sí: agregás todos los servicios que necesites al mismo caso (por ejemplo, corona y encerado de diagnóstico). En fresado e impresión, una solicitud por producto para que el laboratorio la cotice con precisión.",
    },
  ],
} as const;

export const FINAL_CTA = {
  title: "¿Tenés un escaneo a mano? Pedí el diseño ahora.",
  subtitle: "Cinco minutos para cargar el caso. El resto lo hacemos nosotros.",
  primary: { label: "Pedir un diseño", href: "/disenos/solicitar" },
  secondary: { label: "Cotizar fresado en Uruguay", href: "/fresado/solicitar" },
  note: "Sin cuenta previa · Previsualización antes de entregar · Soporte por email",
} as const;

export const FOOTER = {
  tagline: "Plataforma de odontología digital. Diseño CAD online, fresado e impresión en Uruguay y software para clínicas y laboratorios.",
  groups: [
    {
      title: "Servicios",
      links: [
        { label: "Diseño CAD online", href: "/disenos/solicitar" },
        { label: "Fresado e impresión", href: "/fresado/solicitar" },
        { label: "Todos los servicios", href: "#servicios" },
      ],
    },
    {
      title: "Plataforma",
      links: [
        { label: "Cómo funciona", href: "#como-funciona" },
        { label: "Funciones", href: "#plataforma" },
        { label: "Precios", href: "#precios" },
        { label: "Iniciar sesión", href: "/auth/login" },
      ],
    },
    {
      title: "Ayuda",
      links: [
        { label: "Preguntas frecuentes", href: "#faq" },
      ],
    },
  ],
} as const;
