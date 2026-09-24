import { describe, it, expect } from "vitest";
import { LAB_PRODUCTS, LAB_WORK_TYPES, getLabProduct } from "@/lib/lab-requests/products";
import { isServiceableCountry, SERVICEABLE_COUNTRIES } from "@/lib/lab-requests/country";
import {
  buildLabRequestStoragePath, sanitizeFileName, validateLabRequestFile, MAX_LAB_REQUEST_FILE_BYTES,
} from "@/lib/lab-requests/files";
import { buildOrderFromRequest, buildOrderNotes, nextOrderNumber } from "@/lib/lab-requests/convert";
import { LOCAL_BLOCKS } from "@/content/servicios";
import { WORK_TYPE_LABELS } from "@/lib/work-types";
import type { LabRequest } from "@/lib/lab-requests/types";

const base: LabRequest = {
  id: "11111111-1111-1111-1111-111111111111",
  request_number: "SOL-000007",
  lab_org_id: "22222222-2222-2222-2222-222222222222",
  status: "pending_review",
  professional_name: "Dra. Pérez",
  email: "perez@clinica.uy",
  phone: "099 123 456",
  clinic_name: "Clínica Centro",
  country: "UY",
  department: "Montevideo",
  city: "Montevideo",
  address: "18 de Julio 1234",
  product_key: "zirconio",
  catalog_name: "Zirconio",
  catalog_item_id: "33333333-3333-3333-3333-333333333333",
  material: "Zirconio",
  quantity: 2,
  tooth_positions: ["16", "26"],
  shade: "A2",
  urgency: "urgent",
  patient_ref: "P-0421",
  notes: "Antagonista en el ZIP.",
  file_status: "uploaded",
  file_name: "caso.stl",
  file_size: 1024,
  storage_path: "11111111-1111-1111-1111-111111111111/caso.stl",
  existing_case_ref: null,
  idempotency_key: "44444444-4444-4444-4444-444444444444",
  source: "landing",
  accepted_terms_at: "2026-09-24T12:00:00Z",
  lab_order_id: null,
  dentist_org_id: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: "2026-09-24T12:00:00Z",
  updated_at: "2026-09-24T12:00:00Z",
};

describe("[040] productos públicos ↔ landing ↔ catálogo", () => {
  it("cada card de fresado/impresión de la landing tiene su producto, con el MISMO nombre de catálogo", () => {
    const cards = LOCAL_BLOCKS.flatMap((b) => b.items);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const product = getLabProduct(card.key);
      expect(product, `card ${card.key} sin producto`).toBeDefined();
      expect(product!.catalogName).toBe(card.catalogName);
      expect(card.href).toBe(`/fresado/solicitar?producto=${encodeURIComponent(card.key)}`);
    }
  });

  it("no hay productos sin card (el mapa no inventa servicios)", () => {
    const cardKeys = new Set(LOCAL_BLOCKS.flatMap((b) => b.items.map((i) => i.key)));
    for (const p of LAB_PRODUCTS) expect(cardKeys.has(p.key), p.key).toBe(true);
  });

  it("todo work_type por defecto existe en el enum y tiene etiqueta", () => {
    for (const p of LAB_PRODUCTS) {
      expect(LAB_WORK_TYPES).toContain(p.defaultWorkType);
      expect(WORK_TYPE_LABELS[p.defaultWorkType]).toBeTruthy();
    }
    // La lista cerrada y las etiquetas existentes describen el mismo enum.
    expect([...LAB_WORK_TYPES].sort()).toEqual(Object.keys(WORK_TYPE_LABELS).sort());
  });

  it("el fresado de un STL ajeno exige archivo; un modelo no pide piezas ni color", () => {
    expect(getLabProduct("fresado-stl")!.file).toBe("required");
    expect(getLabProduct("modelos")!.asksTeeth).toBe(false);
    expect(getLabProduct("modelos")!.asksShade).toBe(false);
    expect(getLabProduct("no-existe")).toBeUndefined();
    expect(getLabProduct(null)).toBeUndefined();
  });
});

describe("[040] compuerta de país", () => {
  it("solo Uruguay, sin importar mayúsculas ni espacios", () => {
    expect(SERVICEABLE_COUNTRIES).toEqual(["UY"]);
    expect(isServiceableCountry("UY")).toBe(true);
    expect(isServiceableCountry(" uy ")).toBe(true);
    expect(isServiceableCountry("AR")).toBe(false);
    expect(isServiceableCountry("GB")).toBe(false);
    expect(isServiceableCountry("")).toBe(false);
    expect(isServiceableCountry(null)).toBe(false);
  });
});

describe("[040] archivos", () => {
  it("acepta mallas y exports, rechaza imágenes, vacíos y gigantes", () => {
    expect(validateLabRequestFile("caso.STL", 10).ok).toBe(true);
    expect(validateLabRequestFile("scan.3oxz", 10).ok).toBe(true);
    expect(validateLabRequestFile("foto.jpg", 10).ok).toBe(false);
    expect(validateLabRequestFile("sin-extension", 10).ok).toBe(false);
    expect(validateLabRequestFile("caso.stl", 0).ok).toBe(false);
    expect(validateLabRequestFile("caso.stl", MAX_LAB_REQUEST_FILE_BYTES + 1).ok).toBe(false);
  });

  it("sanea el nombre sin perder la extensión y sin permitir rutas", () => {
    expect(sanitizeFileName("Arcada Superior (v2).stl")).toBe("Arcada_Superior_v2_.stl");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("ñandú.ply")).toBe("nandu.ply");
    expect(sanitizeFileName("")).toBe("archivo");
    expect(buildLabRequestStoragePath(base.id, "mi caso.stl")).toBe(`${base.id}/mi_caso.stl`);
  });
});

describe("[040] conversión a orden", () => {
  it("numera igual que el diálogo de nueva orden: ORDEN max+1, ignorando basura", () => {
    expect(nextOrderNumber([])).toBe("ORDEN 1");
    expect(nextOrderNumber([{ order_number: "ORDEN 12" }, { order_number: "ORDEN 7" }, { order_number: "X" }, { order_number: null }]))
      .toBe("ORDEN 13");
  });

  it("arma la orden y el ítem con lo que decidió el laboratorio", () => {
    const rows = buildOrderFromRequest(
      base,
      { dentist_org_id: "55555555-5555-5555-5555-555555555555", work_type: "corona_zirconia", unit_price: 5200, due_date: "2026-10-01" },
      "ORDEN 13",
    );
    expect(rows.order).toMatchObject({
      order_number: "ORDEN 13",
      lab_org_id: base.lab_org_id,
      dentist_org_id: "55555555-5555-5555-5555-555555555555",
      status: "received",
      priority: "urgent",
      due_date: "2026-10-01",
    });
    expect(rows.item).toEqual({
      work_type: "corona_zirconia",
      material: "Zirconio",
      shade: "A2",
      tooth_positions: ["16", "26"],
      quantity: 2,
      unit_price: 5200,
      catalog_item_id: base.catalog_item_id,
      selected_extras: [],
    });
  });

  it("precio 0 es un precio; sin precio es null; piezas vacías son null", () => {
    const zero = buildOrderFromRequest({ ...base, tooth_positions: [] }, { dentist_org_id: "x", work_type: "otro", unit_price: 0 }, "ORDEN 1");
    expect(zero.item.unit_price).toBe(0);
    expect(zero.item.tooth_positions).toBeNull();
    const none = buildOrderFromRequest({ ...base, urgency: "normal" }, { dentist_org_id: "x", work_type: "otro" }, "ORDEN 1");
    expect(none.item.unit_price).toBeNull();
    expect(none.order.priority).toBe("normal");
  });

  it("las notas llevan contacto, entrega y referencia, nunca un nombre de paciente", () => {
    const notes = buildOrderNotes(base);
    expect(notes).toContain("SOL-000007");
    expect(notes).toContain("perez@clinica.uy");
    expect(notes).toContain("18 de Julio 1234, Montevideo, Montevideo");
    expect(notes).toContain("Ref. paciente: P-0421");
    expect(notes).toContain("Antagonista en el ZIP.");
    expect(notes).not.toMatch(/paciente:\s*[A-Z][a-z]+ [A-Z]/);
  });
});
