import { describe, it, expect } from "vitest";
import {
  ACEPTAR_MS,
  MAX_INTENTOS,
  MAXIMO_TRAS_ACEPTAR_MS,
  agotoIntentos,
  momentoDelRecordatorio,
  vencimientoParaAceptar,
  vencimientoTrasAceptar,
} from "@/lib/design/dispatch/policy";
import { quiereRevisionAutomatica } from "@/lib/design/dispatch/publish";
import {
  elegirDisenador,
  categoriaDelCaso,
  type CandidatoDisenador,
} from "@/lib/design/dispatch/select";
import { buildClientReadyEmail } from "@/lib/design/client-email";
import {
  generarToken,
  hashDeToken,
  hashesIguales,
  tokenTieneFormaValida,
  urlDeEntrega,
} from "@/lib/design/dispatch/token";

const HORA = 60 * 60 * 1000;
const ahora = new Date("2026-01-10T12:00:00.000Z");

describe("[043] política de tiempos del reparto", () => {
  it("un caso normal se puede aceptar durante 48 horas", () => {
    const vence = vencimientoParaAceptar("normal", ahora);
    expect(vence.getTime() - ahora.getTime()).toBe(48 * HORA);
    expect(ACEPTAR_MS).toBe(48 * HORA);
  });

  it("un caso urgente corre con la mitad de los tiempos", () => {
    expect(vencimientoParaAceptar("urgent", ahora).getTime() - ahora.getTime()).toBe(24 * HORA);
    expect(momentoDelRecordatorio("urgent", ahora).getTime() - ahora.getTime()).toBe(12 * HORA);
  });

  it("el recordatorio de un caso normal sale a las 24 horas", () => {
    expect(momentoDelRecordatorio("normal", ahora).getTime() - ahora.getTime()).toBe(24 * HORA);
  });

  // Una vez aceptado, el diseñador necesita el enlace todo el trabajo, no 48 h.
  it("al aceptar, el token se estira hasta la fecha límite más 48 horas", () => {
    const limite = "2026-01-15T12:00:00.000Z";
    const vence = vencimientoTrasAceptar(limite, ahora);
    expect(vence.toISOString()).toBe("2026-01-17T12:00:00.000Z");
  });

  it("sin fecha límite se usa el techo duro de 14 días", () => {
    const vence = vencimientoTrasAceptar(null, ahora);
    expect(vence.getTime() - ahora.getTime()).toBe(MAXIMO_TRAS_ACEPTAR_MS);
  });

  // Ningún token puede vivir para siempre, ni con una fecha límite absurda.
  it("una fecha límite lejanísima no supera el techo de 14 días", () => {
    const vence = vencimientoTrasAceptar("2030-01-01T00:00:00.000Z", ahora);
    expect(vence.getTime() - ahora.getTime()).toBe(MAXIMO_TRAS_ACEPTAR_MS);
  });

  it("una fecha límite ya vencida cae al techo, no a un token muerto", () => {
    const vence = vencimientoTrasAceptar("2025-01-01T00:00:00.000Z", ahora);
    expect(vence.getTime()).toBeGreaterThan(ahora.getTime());
  });

  it("una fecha límite basura no rompe: cae al techo", () => {
    const vence = vencimientoTrasAceptar("no-es-una-fecha", ahora);
    expect(vence.getTime() - ahora.getTime()).toBe(MAXIMO_TRAS_ACEPTAR_MS);
  });

  // El corte es lo que evita que un caso imposible rote para siempre.
  it("corta el reparto automático al tercer intento", () => {
    expect(MAX_INTENTOS).toBe(3);
    expect(agotoIntentos(1)).toBe(false);
    expect(agotoIntentos(2)).toBe(false);
    expect(agotoIntentos(3)).toBe(true);
    expect(agotoIntentos(9)).toBe(true);
  });
});

describe("[043] token de entrega", () => {
  it("genera tokens distintos y con forma válida", () => {
    const a = generarToken();
    const b = generarToken();
    expect(a).not.toBe(b);
    expect(tokenTieneFormaValida(a)).toBe(true);
    expect(tokenTieneFormaValida(b)).toBe(true);
  });

  it("el hash es estable y distinto por token", () => {
    const t = generarToken();
    expect(hashDeToken(t)).toBe(hashDeToken(t));
    expect(hashDeToken(t)).not.toBe(hashDeToken(generarToken()));
    expect(hashDeToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  // El token nunca debe poder deducirse de lo que se guarda.
  it("el hash no contiene al token", () => {
    const t = generarToken();
    expect(hashDeToken(t)).not.toContain(t.slice(0, 12));
  });

  it("rechaza formas que no pueden venir de generarToken", () => {
    expect(tokenTieneFormaValida("")).toBe(false);
    expect(tokenTieneFormaValida("corto")).toBe(false);
    expect(tokenTieneFormaValida("a".repeat(200))).toBe(false);
    expect(tokenTieneFormaValida("tiene/barra/y.puntos-aaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(tokenTieneFormaValida("../../etc/passwd")).toBe(false);
  });

  it("compara hashes sin filtrar por longitud distinta", () => {
    const h = hashDeToken("x");
    expect(hashesIguales(h, h)).toBe(true);
    expect(hashesIguales(h, hashDeToken("y"))).toBe(false);
    expect(hashesIguales(h, "corto")).toBe(false);
  });

  it("arma la URL sin duplicar la barra final", () => {
    expect(urlDeEntrega("https://app.uy", "abc")).toBe("https://app.uy/d/entrega/abc");
    expect(urlDeEntrega("https://app.uy/", "abc")).toBe("https://app.uy/d/entrega/abc");
  });
});


describe("[044] interruptor de revisión automática", () => {
  // Ante cualquier duda, control interno: el archivo lo subió alguien sin cuenta.
  it("por defecto NO publica al cliente", () => {
    expect(quiereRevisionAutomatica(null)).toBe(false);
    expect(quiereRevisionAutomatica(undefined)).toBe(false);
    expect(quiereRevisionAutomatica({})).toBe(false);
    expect(quiereRevisionAutomatica({ otra_cosa: true })).toBe(false);
  });

  it("solo el booleano true enciende el automático", () => {
    expect(quiereRevisionAutomatica({ design_auto_client_review: true })).toBe(true);
    expect(quiereRevisionAutomatica({ design_auto_client_review: false })).toBe(false);
    // Un "true" de texto no alcanza: settings es jsonb y podría traer cualquier cosa.
    expect(quiereRevisionAutomatica({ design_auto_client_review: "true" })).toBe(false);
    expect(quiereRevisionAutomatica({ design_auto_client_review: 1 })).toBe(false);
  });

  it("no se rompe con basura", () => {
    expect(quiereRevisionAutomatica("no soy un objeto")).toBe(false);
    expect(quiereRevisionAutomatica(42)).toBe(false);
  });
});

describe("[044] aviso al cliente", () => {
  const base = {
    orderNumber: "DIS-000007",
    patientRef: "REF-12",
    studioName: "Estudio de Diseño Digital",
    clientName: "Clínica Centro",
    orderUrl: "https://app.uy/dashboard/design/abc",
    revisionCount: 0,
  };

  it("distingue la primera entrega de una revisión", () => {
    expect(buildClientReadyEmail(base).subject).toContain("está listo");
    expect(buildClientReadyEmail({ ...base, revisionCount: 2 }).subject).toContain("revisión");
  });

  // El entregable se libera al aprobar, no antes: prometer la descarga
  // haría que el cliente entre, no la encuentre y escriba.
  it("no promete la descarga del archivo", () => {
    const { text, html } = buildClientReadyEmail(base);
    expect(text).toContain("cuando apruebes");
    expect(html).toContain("cuando apruebes");
    expect(text.toLowerCase()).not.toContain("descargá el stl");
  });

  it("lleva el enlace a la plataforma y no archivos adjuntos", () => {
    const { text, html } = buildClientReadyEmail(base);
    expect(text).toContain(base.orderUrl);
    expect(html).toContain(base.orderUrl);
    expect(html).not.toContain("supabase.co/storage");
  });

  it("escapa el contenido que viene de la base", () => {
    const { html } = buildClientReadyEmail({ ...base, clientName: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("aguanta un caso sin referencia", () => {
    const { text } = buildClientReadyEmail({ ...base, patientRef: null });
    expect(text).toContain("sin referencia");
  });
});

describe("[045] selector de diseñador", () => {
  const D = (over: Partial<CandidatoDisenador> = {}): CandidatoDisenador => ({
    id: over.id ?? "d1",
    full_name: over.full_name ?? "Diseñador",
    is_available: over.is_available ?? true,
    max_concurrent: over.max_concurrent ?? 3,
    specialties: over.specialties ?? [],
    casos_abiertos: over.casos_abiertos ?? 0,
    last_assigned_at: over.last_assigned_at ?? null,
  });

  it("no elige a nadie si no hay candidatos", () => {
    const r = elegirDisenador([], "restaurador");
    expect(r.elegido).toBeNull();
    expect(r.razon).toContain("no hay diseñadores aprobados");
  });

  // Vacaciones: el bot deja de mandarle sin tener que borrarlo.
  it("descarta a quien no está disponible", () => {
    const r = elegirDisenador([D({ id: "a", is_available: false })], null);
    expect(r.elegido).toBeNull();
    expect(r.descartados).toEqual([{ id: "a", full_name: "Diseñador", motivo: "no_disponible" }]);
  });

  it("descarta a quien está en su tope de casos", () => {
    const r = elegirDisenador([D({ id: "a", casos_abiertos: 3, max_concurrent: 3 })], null);
    expect(r.elegido).toBeNull();
    expect(r.descartados[0].motivo).toBe("al_tope");
  });

  it("acepta a quien está justo debajo del tope", () => {
    const r = elegirDisenador([D({ id: "a", casos_abiertos: 2, max_concurrent: 3 })], null);
    expect(r.elegido?.id).toBe("a");
  });

  // El que nunca recibió nada entra primero: si no, nunca arrancaría.
  it("prioriza a quien nunca recibió un caso", () => {
    const r = elegirDisenador(
      [D({ id: "viejo", last_assigned_at: "2020-01-01T00:00:00Z" }), D({ id: "nuevo", last_assigned_at: null })],
      null,
    );
    expect(r.elegido?.id).toBe("nuevo");
  });

  it("entre asignados, elige al que hace más tiempo no recibe", () => {
    const r = elegirDisenador(
      [
        D({ id: "reciente", last_assigned_at: "2026-09-27T00:00:00Z" }),
        D({ id: "antiguo", last_assigned_at: "2026-09-01T00:00:00Z" }),
      ],
      null,
    );
    expect(r.elegido?.id).toBe("antiguo");
  });

  it("prefiere a quien declaró la categoría del caso", () => {
    const r = elegirDisenador(
      [
        D({ id: "generalista", last_assigned_at: "2020-01-01T00:00:00Z", specialties: [] }),
        D({ id: "especialista", last_assigned_at: "2026-09-27T00:00:00Z", specialties: ["implantes"] }),
      ],
      "implantes",
    );
    // Gana el especialista aunque acabe de recibir uno: la rotación
    // desempata DENTRO de los que tienen la especialidad, no por encima.
    expect(r.elegido?.id).toBe("especialista");
    expect(r.razon).toContain("Implantes");
  });

  // Mejor asignado a alguien capaz que trabado esperando al especialista.
  it("si nadie declaró la categoría, no descarta a nadie", () => {
    const r = elegirDisenador(
      [D({ id: "a", specialties: ["removible"] }), D({ id: "b", specialties: [] })],
      "implantes",
    );
    expect(r.elegido).not.toBeNull();
    expect(r.razon).toContain("nadie declaró");
  });

  it("la especialidad no salta por encima de la disponibilidad", () => {
    const r = elegirDisenador(
      [
        D({ id: "especialista", specialties: ["implantes"], casos_abiertos: 5, max_concurrent: 5 }),
        D({ id: "libre", specialties: [] }),
      ],
      "implantes",
    );
    expect(r.elegido?.id).toBe("libre");
  });

  it("la razón queda guardada y nombra la especialidad", () => {
    const r = elegirDisenador([D({ id: "a", specialties: ["restaurador"] })], "restaurador");
    expect(r.razon).toContain("Restaurador");
    expect(r.razon.length).toBeGreaterThan(10);
  });

  it("es determinista ante empate total", () => {
    const candidatos = [D({ id: "b" }), D({ id: "a" }), D({ id: "c" })];
    const primera = elegirDisenador(candidatos, null).elegido?.id;
    const segunda = elegirDisenador([...candidatos].reverse(), null).elegido?.id;
    expect(primera).toBe(segunda);
  });
});

describe("[045] categoría del caso", () => {
  it("toma la del primer ítem que el catálogo reconoce", () => {
    expect(categoriaDelCaso(["crown_bridge"])).toBe("restaurador");
    expect(categoriaDelCaso(["custom_abutment"])).toBe("implantes");
    expect(categoriaDelCaso(["complete_denture"])).toBe("removible");
  });

  it("ignora códigos desconocidos hasta encontrar uno válido", () => {
    expect(categoriaDelCaso(["inventado", null, "crown_bridge"])).toBe("restaurador");
  });

  it("devuelve null si ningún ítem se reconoce", () => {
    expect(categoriaDelCaso([])).toBeNull();
    expect(categoriaDelCaso([null, "no-existe"])).toBeNull();
  });
});
