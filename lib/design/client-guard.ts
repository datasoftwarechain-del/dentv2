/**
 * [037] Qué puede ver un cliente que solo compra diseños.
 *
 * Su cuenta existe para una cosa: pedir un STL y recibirlo. No contrató
 * el ERP, así que las pantallas de pacientes, agenda, producción, stock
 * y catálogo no son suyas.
 *
 * El menú ya no se las muestra, pero el menú no es una barrera: alguien
 * que escribe la URL a mano llega igual. La barrera está acá, del lado
 * del servidor, y es la que cuenta.
 */

/** Rutas del panel a las que un design_client sí puede entrar. */
const ALLOWED_PREFIXES = [
  "/dashboard/design",
  "/dashboard/settings",
];

export function isDesignClientAllowed(pathname: string): boolean {
  if (pathname === "/dashboard") return true; // su inicio: se le redirige
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** A dónde mandar a un design_client que llegó donde no corresponde. */
export const DESIGN_CLIENT_HOME = "/dashboard/design";
