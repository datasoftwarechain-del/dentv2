/**
 * Superficie común de los campos de formulario (input, textarea, select).
 *
 * Antes cada uno tenía su propio juego de clases y no coincidían: el input
 * medía 40 px y el select 36; el input enfocaba con `ring-2 ring-accent` y
 * el textarea con `ring-2 ring-ring`; el select con `ring-1`. Tres campos
 * en la misma fila se veían de tres tamaños y encendían de tres colores.
 *
 * El criterio, de las guías de Apple:
 *
 *  - **Un campo es una superficie HUNDIDA, no un rectángulo dibujado.** La
 *    sombra interior de 1 px le da el borde superior oscurecido que lee
 *    como profundidad. Es la diferencia entre "hay una caja acá" y "acá se
 *    escribe".
 *  - **Enfocar cambia el MATERIAL, no solo agrega un anillo.** El fondo
 *    sube a opaco, el borde se tiñe y la sombra interior se apaga: el campo
 *    deja de estar hundido y pasa a estar activo. Un anillo solo es un
 *    adorno; esto comunica estado.
 *  - **El hover anticipa.** El borde se oscurece antes de llegar, así el
 *    campo acusa recibo del puntero.
 *  - 150 ms: por encima de eso la respuesta deja de leerse como inmediata.
 */
export const FIELD_SURFACE = [
  // Caja
  "flex w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm",
  "shadow-[inset_0_1px_2px_rgba(18,45,60,.06)]",
  // Texto
  "placeholder:text-muted-foreground",
  // Movimiento
  "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
  // Hover: anticipa
  "hover:border-input/80 hover:bg-background/80",
  // Foco: cambia el material, no solo agrega anillo
  "focus-visible:outline-none focus-visible:bg-background focus-visible:border-accent",
  "focus-visible:shadow-[0_0_0_3px_hsl(var(--accent)/.18)]",
  // Inválido: el navegador ya sabe, que se vea
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:shadow-[0_0_0_3px_hsl(var(--destructive)/.15)]",
  // Deshabilitado
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
].join(" ");

/** Alto único de los campos de una línea. Antes input 40 px y select 36. */
export const FIELD_HEIGHT = "h-10";
