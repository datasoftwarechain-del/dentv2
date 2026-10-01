# Auditoría UI/UX — DigitalDent v2 · 2026-10-01

Marco: **Apple Design** (skill `apple-design` — *Designing Fluid Interfaces* WWDC18,
*The Details of UI Typography* WWDC20, *Principles of Great Design* WWDC26).
Énfasis en la landing, como se pidió. Método: Read/Grep directo sobre el árbol,
sin subagentes. Rama auditada: `main` = `431f5ac`.

La tesis del marco: **una interfaz se siente viva cuando el movimiento arranca del
valor que hay en pantalla, hereda la velocidad del usuario, proyecta el impulso
hacia adelante, y puede agarrarse y revertirse en cualquier instante.**

---

## P0 — Lo que más separa esta landing de "fluida"

### 1. El coverflow de Servicios no sigue el dedo

Es la interacción principal de la página y rompe cinco principios a la vez.
`components/landing/servicios/coverflow.tsx`:

```js
const onPanEnd = (_e, info: PanInfo) => {
  const dx = info.offset.x, vx = info.velocity.x;
  if (dx < -PAN_THRESHOLD_PX || vx < -PAN_VELOCITY) goUser(active + 1);
  else if (dx > PAN_THRESHOLD_PX || vx > PAN_VELOCITY) goUser(active - 1);
};
```

- **§1 Respuesta / §2 Manipulación directa.** Durante todo el arrastre **no se mueve
  nada**. El componente solo lee `offset` y `velocity` AL SOLTAR. El usuario empuja y
  la interfaz no acusa recibo hasta que levanta el dedo. "Touch and content should
  move together" — acá no se tocan.
- **§3 Interrumpibilidad.** El desplazamiento es
  `transition: transform 360ms ${EASE}`, una transición CSS de duración fija. No se
  puede agarrar en vuelo ni revertir: dos flicks seguidos no se mezclan, el segundo
  espera al primero. El marco es explícito: evitar transiciones CSS para cualquier
  cosa dirigida por gesto.
- **§5 Entrega de velocidad / §6 Proyección de impulso.** Es un umbral binario. Un
  flick fuerte y un arrastre lento que apenas cruza el umbral avanzan **exactamente
  una card**. No hay "tirar" la pila. Falta la proyección
  `current + (v/1000)·d/(1−d)` con `d ≈ 0.998` y el traspaso de la velocidad de
  salida al spring.

> **Arreglo:** un `motion.div` con `drag="x"`, `dragConstraints`, el offset del
> arrastre mapeado 1:1 a `translateX` de la pila, y al soltar: proyectar el punto de
> reposo, elegir la card más cercana a esa proyección y animar con
> `{ type: "spring", bounce: 0.2, duration: 0.4 }` pasándole `velocity`. Es el único
> lugar de la landing donde el bounce está justificado, porque hubo momento físico.

### 2. Las animaciones de entrada ignoran `prefers-reduced-motion`

`ScrollSection` envuelve **todas** las secciones de `app/page.tsx` y cada una entra
con `y: 32`:

```js
initial={{ opacity: 0, y: 32 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
```

No hay `MotionConfig` ni `useReducedMotion` en el árbol de la landing — las dos
únicas apariciones están en `coverflow.tsx` y `design-arc.tsx`. Las 12 clases
`motion-reduce:` que sí existen cubren **transiciones CSS**, no Framer Motion.

Resultado: alguien con sensibilidad vestibular recibe diez secciones deslizándose
hacia arriba, más la cascada escalonada del hero, más los pilares, los pasos, los
beneficios y los planes. El sistema operativo le pidió lo contrario.

> **Arreglo: una línea.** `<MotionConfig reducedMotion="user">` envolviendo el árbol
> de la landing en `app/page.tsx`. Framer Motion entonces ignora `x`/`y`/`scale` y
> conserva `opacity` — exactamente lo que pide §14: un equivalente más suave, no la
> ausencia de feedback.

### 3. Cero springs en toda la landing

Veinticuatro animaciones con `duration` fija; **un solo spring** en todo el conjunto,
y está en `design-arc.tsx`. §4 es claro: lo que el usuario puede tocar se anima con
springs, porque una animación de duración fija no puede responder a una entrada nueva.

El perfil recomendado por el marco, traducido a este proyecto:

| Elemento | Hoy | Debería |
|---|---|---|
| Entradas de sección (nadie las toca) | tween 0.65 s | está bien como tween |
| Cards de servicio y pilares (hover) | `transition-[transform] 200ms` | spring `bounce 0`, `duration 0.3` |
| Coverflow (gesto) | CSS 360 ms | spring `bounce 0.2`, `duration 0.4` + velocidad |
| Menú móvil del header | tween | spring `bounce 0`, `duration 0.3` |

---

## P1

### 4. `tracking-tight` fijo sobre un rango de 3,3× de tamaño

`-0.025em` aplicado igual al wordmark del header (`text-lg`, 18 px) y al titular del
hero (`text-6xl`, 60 px). Once titulares, un solo valor.

§15 es la regla más dura del marco en tipografía: **el tracking es específico del
tamaño, nunca uno solo para todos.** El texto grande quiere tracking negativo
—las letras se leen demasiado separadas al crecer—; el texto chico quiere un poco de
positivo. A 18 px, `-0.025em` aprieta de más; a 60 px se queda corto.

> **Arreglo:** escala por tamaño. `text-lg` → `tracking-normal`; `text-2xl/3xl` →
> `tracking-[-.01em]`; `text-4xl/5xl` → `tracking-[-.02em]`; el hero `text-6xl` →
> `tracking-[-.03em]`. Lo mismo con `leading`: hoy el hero ya usa `leading-[1.08]`,
> que está bien; los `text-3xl` sin `leading` heredan uno demasiado suelto.

### 5. El latido del coverflow está en la frecuencia que el marco desaconseja

```js
animate={{ y: [0, -5, 0] }}
transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
```

§14 señala explícitamente las **oscilaciones lentas en bucle cerca de 0,2 Hz (un
ciclo cada 5 s)**. Esto es exactamente un ciclo cada 5 segundos, infinito, en el
elemento más grande de la sección.

Atenuante real: **está correctamente gateado por `reduceMotion`**. Quien pide menos
movimiento no lo sufre. Para el resto, bajarlo a ~3 s o a ±3 px lo saca de la zona.

### 6. Los puntos del carrusel miden 8 × 8 px

Son `<button role="tab">` reales, con `onClick`, `aria-selected` y `aria-label`
—la semántica está impecable— pero el objetivo táctil es `h-2` con `width: 8`.

El mínimo es 44 × 44, y §10 pide además ~10 px de histéresis alrededor del objetivo.
Hoy no hay ni padding de impacto.

> **Arreglo:** envolver el punto en un botón de `h-11 w-11` con el punto dibujado
> dentro, o `::before` con `inset: -16px`. El aspecto no cambia; el área sí.

### 7. Feedback de presión casi inexistente

Seis apariciones en toda la landing, y cinco son `active:translate-y-0`, que **no es
feedback de presión**: solo cancela el levantamiento del hover. En un dispositivo
táctil, donde no hay hover, equivale a nada.

La única presión real de la página es el FAB del chat (`whileTap={{ scale: 0.95 }}`).

§1: la respuesta va en **pointer-down**, no al soltar, y en el momento en que aparece
latencia "la sensación de control se cae por un precipicio".

> **Arreglo:** `active:scale-[0.97]` con `transition-transform duration-100` en el
> `Button` base — un solo cambio en `components/ui/button.tsx` cubre toda la app.

### 8. Foco visible en 15 de ~26 elementos interactivos

La utilidad `.focus-ring` existe y está bien definida en `globals.css`, pero no se
aplica de forma pareja. Cada interactivo sin foco visible es un elemento inalcanzable
para quien navega con teclado.

---

## P2 — Material y chrome

### 9. El header perdió su material, y fue decisión mía

Hoy: `bg-background/95 backdrop-blur-md`. Lo cambié en esta misma sesión porque
`.glass` (`bg-white/10`) tomaba el color de lo que pasara por debajo y sobre la
sección oscura del coverflow los links quedaban ilegibles.

Resolvió el problema real, pero **cambió artesanía por legibilidad**, y §12 ofrece la
salida correcta: el chrome flotante debe ser una capa translúcida con el contenido
pasando por debajo, y la legibilidad se resuelve con **vibrancy** —texto de más
contraste, peso un poco mayor, un toque de letter-spacing— no subiendo la opacidad
del fondo al 95 %.

> **Arreglo mejor:** volver a una translucidez real (≈`bg-background/70` +
> `backdrop-blur-xl saturate-150`) y cambiar los links de `text-muted-foreground` a
> `text-foreground/80 font-medium`. Sumar
> `@media (prefers-reduced-transparency: reduce) { background: solid }`, que hoy no
> existe en ningún lado del proyecto.

### 10. Borde duro bajo el header en vez de scroll edge effect

`border-b border-border/60` es una línea de 1 px constante. §12 pide **desvanecer un
degradado/blur donde el contenido se encuentra con el chrome flotante**, y solo
cuando efectivamente se superponen. Hoy la línea está siempre, incluso arriba de todo
cuando no hay nada debajo.

### 11. `glass-card`: translúcido claro sobre fondo claro

§12: **nunca apilar una superficie translúcida clara sobre otra** — la legibilidad se
derrumba. `glass-card` (`bg-white/10` + blur) se usa en las tres pantallas de auth
(`login`, `sign-up`, `forgot-password`) sobre fondo casi blanco, y en `newsletter` y
`testimonials` (hoy no montados).

En auth se ve: la card apenas se despega del fondo y el borde `white/20` es invisible.

---

## Lo que está bien hecho

- **`ScopeChip` comunica por tres canales** —ícono, texto y forma (relleno para
  Online, borde punteado para Uruguay)—, con la razón escrita en el propio archivo.
  Es exactamente §16 Flexibilidad y Familiaridad bien entendidas, y resuelve
  daltonismo y lector de pantalla de una.
- **El coverflow tiene teclado (← →), `role="tab"`, `aria-selected` y un contador con
  `aria-live="polite"`.** La semántica está mejor que el gesto.
- **`motion-reduce:` en las cards de servicio y en los pilares**, aplicado tanto a la
  transición como al `scale` del hover.
- **Los placeholders con trama diagonal** resuelven la ausencia de fotos sin recurrir
  a imágenes de stock. §16 Artesanía: nada es azaroso.
- **`tabular-nums` en las cifras** de estadísticas y del contador del carrusel: evita
  el salto de ancho al contar.
- **`[text-wrap:pretty]` y `[text-wrap:balance]`** en titulares y párrafos.

---

## Orden sugerido

| # | Qué | Costo | Por qué ahí |
|---|---|---|---|
| 1 | `MotionConfig reducedMotion="user"` | **1 línea** | Es accesibilidad, no estética, y cubre toda la landing de una |
| 2 | `active:scale-[0.97]` en el `Button` base | **1 línea** | Cubre toda la app y es lo que más se siente en móvil |
| 3 | Área táctil de los puntos del carrusel | chico | Hoy son inusables con el pulgar |
| 4 | Escala de tracking por tamaño | chico | Toca 11 titulares, es mecánico |
| 5 | Header translúcido + vibrancy + scroll edge | medio | Deshace un compromiso que tomé hoy |
| 6 | Coverflow con arrastre 1:1, proyección y spring | **grande** | Es el que más cambia la sensación, y el que más riesgo tiene |
| 7 | `glass-card` en auth | medio | Fuera de la landing |

El coverflow va último **no porque importe menos** —es el hallazgo más grande— sino
porque es una reescritura de la interacción central de la página, con gestos, y
necesita probarse en dispositivo real antes de entrar.
