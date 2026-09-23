import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canTransition,
  nextStatuses,
  isTerminal,
  isAwaitingClient,
  isRevisionBillable,
  canClientDownload,
  DESIGN_STATUS_ACTIVE,
  DESIGN_KANBAN_COLUMNS,
  getDesignStatusLabel,
  resolveRevisionCharge,
  statusAfterSubmit,
  isAwaitingPayment,
  DESIGN_STATUS_LABELS,
  DESIGN_STATUS_BADGE_CLASSES,
  type DesignOrderStatus,
} from "@/lib/design/status";
import {
  DESIGN_SERVICES,
  getDesignService,
  getDesignServiceLabel,
  groupServicesByCategory,
  REVISION_FEE_CODE,
  REVISION_FEE_LABEL,
  includedRevisionsForOrder,
  DEFAULT_INCLUDED_REVISIONS,
} from "@/lib/design/services";
import { validateDesignOrderForSubmit } from "@/lib/design/order-validation";
import {
  validateDesignFile,
  buildStoragePath,
  sanitizeFileName,
  MAX_FILE_BYTES,
} from "@/lib/design/files";
import {
  computeDesignItemTotal,
  computeDesignOrderTotals,
} from "@/lib/design/totals";

// ════════════════════════════════════════════════════════════
describe("máquina de estados — quién puede mover qué", () => {
  it("el cliente envía su borrador; el estudio lo toma", () => {
    expect(canTransition("draft", "submitted", "client")).toBe(true);
    expect(canTransition("submitted", "assigned", "studio")).toBe(true);
  });

  it("el cliente NO puede saltarse la cola y poner su orden en diseño", () => {
    expect(canTransition("submitted", "in_design", "client")).toBe(false);
    expect(canTransition("assigned", "in_design", "client")).toBe(false);
  });

  it("solo el cliente aprueba o pide cambios desde client_review", () => {
    expect(canTransition("client_review", "approved", "client")).toBe(true);
    expect(canTransition("client_review", "revision_requested", "client")).toBe(true);
    // El estudio puede aprobar en nombre del cliente (OK telefónico),
    // pero no puede pedirse cambios a sí mismo desde ese estado.
    expect(canTransition("client_review", "approved", "studio")).toBe(true);
    expect(canTransition("client_review", "revision_requested", "studio")).toBe(false);
  });

  it("approved no vuelve a diseño: ya está facturado", () => {
    expect(canTransition("approved", "in_design", "studio")).toBe(false);
    expect(canTransition("approved", "revision_requested", "client")).toBe(false);
    expect(canTransition("approved", "delivered", "studio")).toBe(true);
  });

  it("delivered y cancelled son terminales para todos", () => {
    for (const side of ["client", "studio"] as const) {
      expect(nextStatuses("delivered", side)).toEqual([]);
      expect(nextStatuses("cancelled", side)).toEqual([]);
    }
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("in_design")).toBe(false);
  });

  it("un borrador espera al CLIENTE, no al estudio", () => {
    // Regresión: un pedido del formulario público que no llegaba a subir
    // archivos quedaba en 'draft' — fuera de la cola del estudio Y fuera
    // de la vista "En curso" del cliente. Existía y no lo veía nadie.
    expect(isAwaitingClient("draft")).toBe(true);
    expect(DESIGN_STATUS_ACTIVE).toContain("draft");
  });

  it("el borrador NO entra en la cola del estudio", () => {
    // Está incompleto: no hay nada que el estudio pueda hacer con él.
    expect(DESIGN_KANBAN_COLUMNS.map((c) => c.id)).not.toContain("draft");
  });

  it("needs_info devuelve la pelota al cliente", () => {
    expect(canTransition("in_design", "needs_info", "studio")).toBe(true);
    expect(canTransition("needs_info", "submitted", "client")).toBe(true);
    expect(isAwaitingClient("needs_info")).toBe(true);
    expect(isAwaitingClient("client_review")).toBe(true);
    expect(isAwaitingClient("in_design")).toBe(false);
  });

  it("nadie se queda en el mismo estado ni se mueve por 'system'", () => {
    expect(canTransition("in_design", "in_design", "studio")).toBe(false);
    expect(canTransition("draft", "submitted", "system")).toBe(false);
    expect(nextStatuses("draft", "system")).toEqual([]);
  });

  it("toda transición declarada apunta a un estado válido", () => {
    const valid = Object.keys(DESIGN_STATUS_LABELS) as DesignOrderStatus[];
    for (const from of valid) {
      for (const side of ["client", "studio"] as const) {
        for (const to of nextStatuses(from, side)) {
          expect(valid).toContain(to);
        }
      }
    }
  });

  it("todo estado tiene etiqueta y color de badge", () => {
    const valid = Object.keys(DESIGN_STATUS_LABELS) as DesignOrderStatus[];
    expect(valid.length).toBe(12);
    for (const s of valid) {
      expect(DESIGN_STATUS_LABELS[s]).toBeTruthy();
      expect(DESIGN_STATUS_BADGE_CLASSES[s]).toBeTruthy();
    }
  });

  it("al cliente no se le muestra el detalle interno del estudio", () => {
    expect(getDesignStatusLabel("internal_review", "client")).toBe("En proceso");
    expect(getDesignStatusLabel("assigned", "client")).toBe("En proceso");
    expect(getDesignStatusLabel("internal_review", "studio")).toBe("Control interno");
    // Los estados que sí le importan se nombran igual para ambos.
    expect(getDesignStatusLabel("needs_info", "client")).toBe("Faltan datos");
  });
});

// ════════════════════════════════════════════════════════════
describe("cobro por adelantado", () => {
  it("en cuenta corriente la orden entra derecho a la cola", () => {
    expect(statusAfterSubmit("account")).toBe("submitted");
  });

  it("en prepago se detiene antes de la cola", () => {
    // El estudio no arranca un trabajo impago de alguien a quien no le
    // puede reclamar después.
    expect(statusAfterSubmit("prepaid")).toBe("awaiting_payment");
  });

  it("esperar pago es asunto del cliente, no trabajo del estudio", () => {
    expect(isAwaitingPayment("awaiting_payment")).toBe(true);
    expect(isAwaitingClient("awaiting_payment")).toBe(true);
    expect(DESIGN_KANBAN_COLUMNS.map((c) => c.id)).not.toContain("awaiting_payment");
  });

  it("al cliente se le nombra como una cuenta por pagar", () => {
    expect(getDesignStatusLabel("awaiting_payment", "client")).toBe("Pendiente de pago");
    expect(getDesignStatusLabel("awaiting_payment", "studio")).toBe("Esperando pago");
  });

  it("el cliente puede cancelar mientras no pagó, pero no auto-encolarse", () => {
    expect(canTransition("awaiting_payment", "cancelled", "client")).toBe(true);
    expect(canTransition("awaiting_payment", "submitted", "client")).toBe(false);
  });

  it("el estudio puede encolarla a mano si el pago llegó por fuera", () => {
    expect(canTransition("awaiting_payment", "submitted", "studio")).toBe(true);
  });

  it("una orden esperando pago sigue siendo trabajo vivo", () => {
    expect(DESIGN_STATUS_ACTIVE).toContain("awaiting_payment");
  });
});

describe("revisiones y entrega", () => {
  it("las revisiones incluidas no se cobran; la siguiente sí", () => {
    expect(isRevisionBillable(0, 2)).toBe(false);
    expect(isRevisionBillable(1, 2)).toBe(false);
    expect(isRevisionBillable(2, 2)).toBe(true);
    expect(isRevisionBillable(5, 2)).toBe(true);
  });

  it("un servicio sin revisiones incluidas cobra desde la primera", () => {
    expect(isRevisionBillable(0, 0)).toBe(true);
  });

  it("una revisión dentro de las incluidas no genera cargo", () => {
    const d = resolveRevisionCharge({ revisionCount: 0, includedRevisions: 2, feePrice: 350 });
    expect(d.kind).toBe("included");
  });

  it("pasada la cuota, se cobra el precio del arancel", () => {
    const d = resolveRevisionCharge({ revisionCount: 2, includedRevisions: 2, feePrice: 350 });
    expect(d).toEqual({ kind: "charge", included: 2, price: 350, revisionNumber: 3 });
  });

  it("sin precio cargado NO se inventa un número: la vuelta sale gratis", () => {
    // Facturar un precio que nadie fijó es peor que perder el cargo.
    for (const feePrice of [0, null, undefined, -100]) {
      const d = resolveRevisionCharge({ revisionCount: 5, includedRevisions: 2, feePrice });
      expect(d.kind, `feePrice=${feePrice}`).toBe("unpriced");
    }
  });

  it("el número de revisión que se factura es el de ESTA vuelta", () => {
    // revisionCount es el conteo previo: la que se está pidiendo es la N+1.
    const d = resolveRevisionCharge({ revisionCount: 3, includedRevisions: 1, feePrice: 100 });
    expect(d.kind === "charge" && d.revisionNumber).toBe(4);
  });

  it("un archivo sin liberar no se descarga, aunque esté todo pago", () => {
    expect(
      canClientDownload({ isReleased: false, paymentMode: "account", invoicePaid: true }),
    ).toBe(false);
  });

  it("en cuenta corriente alcanza con que esté liberado", () => {
    expect(
      canClientDownload({ isReleased: true, paymentMode: "account", invoicePaid: false }),
    ).toBe(true);
  });

  it("en prepago el STL no sale hasta que la factura esté paga", () => {
    expect(
      canClientDownload({ isReleased: true, paymentMode: "prepaid", invoicePaid: false }),
    ).toBe(false);
    expect(
      canClientDownload({ isReleased: true, paymentMode: "prepaid", invoicePaid: true }),
    ).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
describe("catálogo de servicios", () => {
  it("están los 12 servicios de la lista publicada", () => {
    expect(DESIGN_SERVICES).toHaveLength(12);
  });

  it("los códigos son únicos", () => {
    const codes = DESIGN_SERVICES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("ningún servicio exige piezas y arcada a la vez", () => {
    // Pedir las dos cosas duplica el trabajo de carga sin agregar datos.
    for (const s of DESIGN_SERVICES) {
      expect(s.requiresTeeth && s.requiresArch).toBe(false);
    }
  });

  it("todo servicio pide al menos un archivo de entrada", () => {
    for (const s of DESIGN_SERVICES) {
      expect(s.requiredInputs.length).toBeGreaterThan(0);
      expect(s.defaultTurnaroundHours).toBeGreaterThan(0);
    }
  });

  it("el cargo por revisión tiene etiqueta propia en facturas y listados", () => {
    expect(getDesignServiceLabel(REVISION_FEE_CODE)).toBe(REVISION_FEE_LABEL);
  });

  it("un código desconocido no rompe: cae al propio código", () => {
    expect(getDesignService("no_existe")).toBeUndefined();
    expect(getDesignServiceLabel("no_existe")).toBe("no_existe");
    expect(getDesignServiceLabel(null)).toBe("(sin servicio)");
  });

  it("el agrupado por categoría no pierde ni duplica servicios", () => {
    const grouped = groupServicesByCategory();
    const total = grouped.reduce((n, g) => n + g.services.length, 0);
    expect(total).toBe(DESIGN_SERVICES.length);
  });
});

// ════════════════════════════════════════════════════════════
describe("revisiones incluidas de una orden", () => {
  it("un servicio solo: las suyas", () => {
    // Cubeta individual incluye 1; All-on-X incluye 3.
    expect(includedRevisionsForOrder(["impression_tray"])).toBe(1);
    expect(includedRevisionsForOrder(["all_on_x"])).toBe(3);
  });

  it("orden mixta: gana el MÁS generoso, no el más estricto", () => {
    // Cobrarle la 2ª vuelta porque la cubeta ya se pasó sería una
    // sorpresa en la factura de un trabajo que era el All-on-X.
    expect(includedRevisionsForOrder(["impression_tray", "all_on_x"])).toBe(3);
    expect(includedRevisionsForOrder(["all_on_x", "impression_tray"])).toBe(3);
  });

  it("el cargo por revisión no cuenta como servicio pedido", () => {
    // Si contara, una orden que ya generó un cargo se auto-ampliaría
    // las revisiones incluidas y no volvería a cobrar nunca.
    expect(includedRevisionsForOrder(["impression_tray", REVISION_FEE_CODE])).toBe(1);
  });

  it("una orden solo de cargos cae al default en vez de a -Infinity", () => {
    expect(includedRevisionsForOrder([REVISION_FEE_CODE])).toBe(DEFAULT_INCLUDED_REVISIONS);
    expect(includedRevisionsForOrder([])).toBe(DEFAULT_INCLUDED_REVISIONS);
  });

  it("un código desconocido asume el default, no cero", () => {
    // Asumir 0 haría que un código viejo empiece a cobrar desde la
    // primera vuelta sin que nadie lo haya decidido.
    expect(includedRevisionsForOrder(["servicio_que_ya_no_existe"])).toBe(
      DEFAULT_INCLUDED_REVISIONS,
    );
  });

  it("encadena con isRevisionBillable como lo hace la ruta de estado", () => {
    const included = includedRevisionsForOrder(["impression_tray"]); // 1
    expect(isRevisionBillable(0, included)).toBe(false); // la 1ª entra
    expect(isRevisionBillable(1, included)).toBe(true);  // la 2ª se cobra
  });
});

describe("compuerta de envío", () => {
  const scan = [{ kind: "input_scan" as const }];

  it("una orden vacía no se envía", () => {
    const r = validateDesignOrderForSubmit([], []);
    expect(r.canSubmit).toBe(false);
    expect(r.errors).toContain("Agregá al menos un servicio de diseño a la orden.");
  });

  it("sin escaneo no se envía, por más completa que esté la orden", () => {
    const r = validateDesignOrderForSubmit(
      [{ service_code: "crown_bridge", tooth_positions: ["11"], arch: null, quantity: 1 }],
      [{ kind: "input_reference" }],
    );
    expect(r.canSubmit).toBe(false);
    expect(r.errors.some((e) => e.includes("escaneo intraoral"))).toBe(true);
  });

  it("una corona sin piezas dentarias no se envía", () => {
    const r = validateDesignOrderForSubmit(
      [{ service_code: "crown_bridge", tooth_positions: [], arch: null, quantity: 1 }],
      scan,
    );
    expect(r.canSubmit).toBe(false);
    expect(r.errors.some((e) => e.includes("pieza dentaria"))).toBe(true);
  });

  it("una férula sin arcada no se envía", () => {
    const r = validateDesignOrderForSubmit(
      [{ service_code: "night_guard_splint", tooth_positions: null, arch: null, quantity: 1 }],
      scan,
    );
    expect(r.canSubmit).toBe(false);
    expect(r.errors.some((e) => e.includes("arcada"))).toBe(true);
  });

  it("un caso bien cargado se envía, con el recordatorio de archivos", () => {
    const r = validateDesignOrderForSubmit(
      [{ service_code: "crown_bridge", tooth_positions: ["11", "12"], arch: null, quantity: 2 }],
      scan,
    );
    expect(r.canSubmit).toBe(true);
    expect(r.errors).toEqual([]);
    // El checklist avisa, pero no bloquea: el .zip del escáner puede traerlo todo.
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("Registro de mordida");
  });

  it("un servicio inexistente se rechaza en vez de pasar de largo", () => {
    const r = validateDesignOrderForSubmit(
      [{ service_code: "corona_de_oro_macizo", tooth_positions: ["11"], arch: null, quantity: 1 }],
      scan,
    );
    expect(r.canSubmit).toBe(false);
    expect(r.errors.some((e) => e.includes("no existe en el catálogo"))).toBe(true);
  });

  it("cantidad cero o negativa se rechaza", () => {
    const r = validateDesignOrderForSubmit(
      [{ service_code: "crown_bridge", tooth_positions: ["11"], arch: null, quantity: 0 }],
      scan,
    );
    expect(r.canSubmit).toBe(false);
    expect(r.errors.some((e) => e.includes("cantidad"))).toBe(true);
  });

  it("null/undefined no explotan", () => {
    expect(validateDesignOrderForSubmit(null, null).canSubmit).toBe(false);
    expect(validateDesignOrderForSubmit(undefined, undefined).canSubmit).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
describe("archivos", () => {
  it("acepta los formatos de escáner habituales", () => {
    for (const name of ["arcada.stl", "MODELO.PLY", "export.zip", "tomo.dcm"]) {
      expect(validateDesignFile(name, 1024, "input_scan").ok).toBe(true);
    }
  });

  it("no deja subir un .exe disfrazado de escaneo", () => {
    const r = validateDesignFile("virus.exe", 1024, "input_scan");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("no admitido");
  });

  it("un PDF no es un escaneo, pero sí una referencia", () => {
    expect(validateDesignFile("indicaciones.pdf", 1024, "input_scan").ok).toBe(false);
    expect(validateDesignFile("indicaciones.pdf", 1024, "input_reference").ok).toBe(true);
  });

  it("rechaza vacíos y pasados de peso", () => {
    expect(validateDesignFile("a.stl", 0, "input_scan").ok).toBe(false);
    expect(validateDesignFile("a.stl", MAX_FILE_BYTES + 1, "input_scan").ok).toBe(false);
    expect(validateDesignFile("a.stl", MAX_FILE_BYTES, "input_scan").ok).toBe(true);
  });

  it("archivo sin extensión se rechaza", () => {
    expect(validateDesignFile("escaneo", 1024, "input_scan").ok).toBe(false);
  });

  it("limpia acentos, espacios y separadores de ruta del nombre", () => {
    expect(sanitizeFileName("Modelo Superior ñandú.stl")).toBe("Modelo_Superior_nandu.stl");
    expect(sanitizeFileName("../../etc/passwd")).toBe("etc_passwd");
  });

  it("la ruta empieza por el UUID de la orden — de eso depende la RLS del bucket", () => {
    const orderId = "3f2a1b4c-0000-4000-8000-000000000001";
    const path = buildStoragePath(orderId, "output_design", 2, "Diseño Final.stl");
    expect(path).toBe(`${orderId}/output_design/2-Diseno_Final.stl`);
    expect(path.split("/")[0]).toBe(orderId);
  });
});

// ════════════════════════════════════════════════════════════
describe("totales", () => {
  it("línea = precio × cantidad + extras (los extras NO se multiplican por la cantidad)", () => {
    const total = computeDesignItemTotal({
      unit_price: 100,
      quantity: 3,
      selected_extras: [{ name: "Urgente", price: 50 }],
    });
    expect(total).toBe(350); // 300 + 50, no 300 + 150
  });

  it("un extra con qty propio sí se multiplica por ese qty", () => {
    const total = computeDesignItemTotal({
      unit_price: 100,
      quantity: 1,
      selected_extras: [{ name: "Pieza extra", price: 20, qty: 3 }],
    });
    expect(total).toBe(160);
  });

  it("suma la orden y marca cuántas líneas no tienen costo cargado", () => {
    const t = computeDesignOrderTotals([
      { unit_price: 100, quantity: 2, unit_cost: 30, selected_extras: [] },
      { unit_price: 200, quantity: 1, unit_cost: null, selected_extras: [] },
    ]);
    expect(t.subtotal).toBe(400);
    expect(t.cost).toBe(60);
    expect(t.margin).toBe(340);
    // El margen de 340 es engañoso y el contador lo dice: falta 1 costo.
    expect(t.itemsWithoutCost).toBe(1);
  });

  it("redondea a 2 decimales en vez de arrastrar flotantes", () => {
    const t = computeDesignOrderTotals([
      { unit_price: 33.33, quantity: 3, selected_extras: [] },
    ]);
    expect(t.subtotal).toBe(99.99);
  });

  it("una orden vacía da todo en cero", () => {
    const t = computeDesignOrderTotals([]);
    expect(t).toEqual({ subtotal: 0, cost: 0, margin: 0, itemsWithoutCost: 0 });
    expect(computeDesignOrderTotals(null).subtotal).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
describe("el sembrado SQL y el catálogo TS no se desincronizan", () => {
  // Los códigos son la bisagra entre el desplegable del cliente, el
  // precio en price_catalog y la línea de la factura. Si el seed y
  // services.ts se separan, el cliente pide un servicio que no tiene
  // precio y la orden se factura en cero sin que nadie lo note.
  const seed = readFileSync(
    join(process.cwd(), "scripts/036_design_studio_setup.sql"),
    "utf-8",
  );

  it("el seed incluye todos los códigos del catálogo", () => {
    for (const service of DESIGN_SERVICES) {
      expect(seed, `falta ${service.code} en 036_design_studio_setup.sql`)
        .toContain(`'${service.code}'`);
    }
  });

  it("el seed no inventa códigos que el catálogo no conoce", () => {
    // Los códigos del seed son el 2º campo de cada fila del VALUES.
    const seeded = Array.from(seed.matchAll(/\(\s*'[^']+',\s*'([a-z_]+)',/g)).map((m) => m[1]);
    expect(seeded.length).toBe(DESIGN_SERVICES.length);
    const known = new Set(DESIGN_SERVICES.map((s) => s.code));
    for (const code of seeded) {
      expect(known, `el seed siembra "${code}", que no existe en services.ts`).toContain(code);
    }
  });

  it("siembra el cargo por revisión, que no es un servicio del desplegable", () => {
    // Va aparte: el cliente nunca lo elige, lo genera el sistema. Si
    // faltara, las revisiones extra no se podrían cobrar nunca.
    expect(seed).toContain(`'${REVISION_FEE_CODE}'`);
    expect(DESIGN_SERVICES.map((s) => s.code)).not.toContain(REVISION_FEE_CODE);
  });

  it("las revisiones incluidas coinciden entre seed y catálogo", () => {
    for (const service of DESIGN_SERVICES) {
      const row = seed
        .split("\n")
        .find((line) => line.includes(`'${service.code}'`) && line.includes("("));
      expect(row, `no encontré la fila de ${service.code}`).toBeTruthy();
      // Campos: (nombre, código, unidad, revisiones, horas, orden)
      const fields = row!.match(/'[^']*',\s*'[^']*',\s*'[^']*',\s*(\d+),\s*(\d+)/);
      expect(fields, `fila mal formada para ${service.code}`).toBeTruthy();
      expect(Number(fields![1]), `revisiones de ${service.code}`).toBe(service.includedRevisions);
      expect(Number(fields![2]), `plazo de ${service.code}`).toBe(service.defaultTurnaroundHours);
    }
  });
});
