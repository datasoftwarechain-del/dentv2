/**
 * [045] A quién le toca el caso.
 *
 * Función pura, sin base de datos ni red: se le pasa el caso y los
 * candidatos, devuelve el elegido y POR QUÉ. Lo segundo importa tanto como
 * lo primero. Cuando un diseñador pregunte por qué le llegan menos casos,
 * la respuesta tiene que estar guardada, no reconstruirse a mano.
 *
 * Los filtros descartan en este orden, y cada uno tiene una razón:
 *
 *   1. **Aprobado y disponible.** Lo obvio, pero también lo que permite
 *      que alguien se tome vacaciones sin que el bot le siga mandando.
 *   2. **Debajo de su techo de casos simultáneos.** Un diseñador con
 *      cinco casos abiertos no rinde más porque le manden el sexto.
 *   3. **Especialidad, como PREFERENCIA y no como requisito.** Si alguien
 *      declaró la categoría del caso, se prefiere. Si nadie la declaró, no
 *      se descarta a nadie: es mejor un caso asignado a alguien capaz que
 *      un caso trabado esperando al especialista perfecto.
 *
 * Desempate: quien hace más tiempo que no recibe un caso. Es rotación pura
 * y se entiende sin leer esto, que es exactamente lo que hace falta cuando
 * alguien sospecha del reparto.
 */

import { getDesignService, DESIGN_SERVICE_CATEGORY_LABELS } from "@/lib/design/services";

export type CategoriaDiseno = "restaurador" | "implantes" | "removible" | "otros";

export interface CandidatoDisenador {
  id: string;
  full_name: string;
  is_available: boolean;
  max_concurrent: number;
  /** Categorías declaradas. Vacío = no declaró, no lo descarta. */
  specialties: string[] | null;
  /** Despachos abiertos ahora mismo (sent + accepted). */
  casos_abiertos: number;
  /** Null = nunca recibió uno: entra primero en la rotación. */
  last_assigned_at: string | null;
}

export type MotivoDescarte = "no_disponible" | "al_tope";

export interface Descarte {
  id: string;
  full_name: string;
  motivo: MotivoDescarte;
}

export type ResultadoSeleccion =
  | { elegido: CandidatoDisenador; razon: string; descartados: Descarte[] }
  | { elegido: null; razon: string; descartados: Descarte[] };

/**
 * Categoría dominante del caso: la del primer ítem que el catálogo
 * reconoce. Un caso con ítems de varias categorías se asigna por la
 * primera; repartir un mismo caso entre dos diseñadores no es una opción.
 */
export function categoriaDelCaso(serviceCodes: Array<string | null>): CategoriaDiseno | null {
  for (const code of serviceCodes) {
    const servicio = getDesignService(code);
    if (servicio) return servicio.category;
  }
  return null;
}

function ordenarPorRotacion(a: CandidatoDisenador, b: CandidatoDisenador): number {
  // Nunca asignado va primero. Después, el más antiguo.
  if (a.last_assigned_at === null && b.last_assigned_at === null) {
    return a.id.localeCompare(b.id); // estable
  }
  if (a.last_assigned_at === null) return -1;
  if (b.last_assigned_at === null) return 1;
  const diff = new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export function elegirDisenador(
  candidatos: CandidatoDisenador[],
  categoria: CategoriaDiseno | null,
): ResultadoSeleccion {
  const descartados: Descarte[] = [];
  const elegibles: CandidatoDisenador[] = [];

  for (const c of candidatos) {
    if (!c.is_available) {
      descartados.push({ id: c.id, full_name: c.full_name, motivo: "no_disponible" });
      continue;
    }
    if (c.casos_abiertos >= c.max_concurrent) {
      descartados.push({ id: c.id, full_name: c.full_name, motivo: "al_tope" });
      continue;
    }
    elegibles.push(c);
  }

  if (elegibles.length === 0) {
    return {
      elegido: null,
      razon: candidatos.length === 0
        ? "no hay diseñadores aprobados"
        : "todos están sin disponibilidad o en su tope de casos",
      descartados,
    };
  }

  const conEspecialidad = categoria
    ? elegibles.filter((c) => (c.specialties ?? []).includes(categoria))
    : [];

  const pool = conEspecialidad.length > 0 ? conEspecialidad : elegibles;
  const elegido = [...pool].sort(ordenarPorRotacion)[0];

  const etiqueta = categoria ? DESIGN_SERVICE_CATEGORY_LABELS[categoria] : null;
  const razon =
    conEspecialidad.length > 0
      ? `declaró ${etiqueta} y era su turno en la rotación (${pool.length} candidato(s) con esa especialidad)`
      : categoria
        ? `nadie declaró ${etiqueta}: era su turno en la rotación entre ${pool.length} disponible(s)`
        : `caso sin categoría reconocida: era su turno en la rotación entre ${pool.length} disponible(s)`;

  return { elegido, razon, descartados };
}
