/**
 * [040_lab_requests] Alcance geográfico de fresado e impresión.
 *
 * Solo Uruguay: el trabajo físico se envía por el país. Un profesional
 * de otro país no queda "en espera": se lo manda al diseño digital, que
 * sí es global. La lista es un array para que abrir otro país sea
 * agregar un código, no tocar el formulario ni el API.
 */

export const SERVICEABLE_COUNTRIES = ["UY"] as const;

export type CountryCode = string;

export function isServiceableCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return (SERVICEABLE_COUNTRIES as readonly string[]).includes(code.trim().toUpperCase());
}

/** Opciones del selector. Los vecinos primero: es de donde llega el tráfico. */
export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "UY", label: "Uruguay" },
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brasil" },
  { code: "PY", label: "Paraguay" },
  { code: "CL", label: "Chile" },
  { code: "ES", label: "España" },
  { code: "US", label: "Estados Unidos" },
  { code: "XX", label: "Otro país" },
];

export const URUGUAY_DEPARTMENTS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores",
  "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro",
  "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
] as const;
