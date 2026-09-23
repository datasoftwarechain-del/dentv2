# Estudio de Diseño Digital — Plan de desarrollo

Nueva línea de negocio: un equipo de diseño que recibe escaneos intraorales
de clientes (odontólogos, clínicas y **laboratorios**), diseña el caso en
CAD/CAM y devuelve el STL terminado. Online, con facturación.

---

## 1. La decisión de fondo: vertical aparte, no `lab_orders`

El módulo vive en tablas propias (`design_orders` y satélites) en vez de
colgarse de las órdenes de laboratorio. Tres razones, en orden de peso:

1. **El cliente puede ser un laboratorio.** `lab_dentist_relations` modela
   dentista↔laboratorio. Un lab-cliente no entra en esa tabla sin
   corromperle el significado a todo lo que la consulta hoy.
2. **El ciclo es distinto.** Hay ida y vuelta con el cliente
   (`client_review` → `revision_requested` → `in_design`) que la producción
   física no tiene, y un contador de revisiones que decide qué se cobra.
3. **Contaminación de métricas.** Meterlo en `lab_orders` mezclaría trabajo
   que nunca pasa por el taller dentro del Kanban de producción, el OTIF,
   la Rentabilidad y el costeo por materiales.

**Lo que sí reutiliza sin escribir nada nuevo:** `organizations`,
`org_members` + permisos, `price_catalog` (precios, extras, overrides por
cliente de 028, `unit_cost` de 033), `invoices` + `ledger_movements`, y
todo el kit de UI, CSRF, Zod y proxy.

### Mapeo de facturación

`invoices` se usa tal cual está. Los nombres de columna son legacy, la
semántica es emisor/pagador:

| Columna de `invoices` | En una orden de diseño |
|---|---|
| `lab_org_id`      | el estudio (quien emite) |
| `dentist_org_id`  | el cliente (quien paga)  |
| `design_order_id` | nueva, excluyente con `order_id` |

Así el estado de cuenta, el saldo, los pagos y el libro mayor que ya
funcionan siguen funcionando, sin tocarlos.

---

## 2. Hallazgos del relevamiento previo

Cosas que encontré mirando el sistema actual y que condicionan el diseño:

- **No hay una sola línea de Supabase Storage en producción.** La tabla
  `order_files` existe desde `001_schema.sql` y nunca se usó.
- **"Casos Digitales" tiene el uploader simulado.**
  `components/cases/case-file-uploader.tsx` finge el progreso con un
  `setInterval` y devuelve una URL placeholder (`/uploads/cases/...`).
- **El guardado de esos archivos es código muerto.**
  `cases-view.tsx` sube al bucket `case-files` e inserta en la tabla
  `case_files` — **ninguno de los dos existe en las migraciones**. Los
  errores se tragan con `console.error` + `continue`, así que la orden se
  crea igual y el archivo se pierde en silencio.
- **Ese intento usaba `getPublicUrl()`**, que dejaría los escaneos
  intraorales legibles por cualquiera con el link.

Por eso el módulo nuevo nace con **bucket privado + signed URLs** y con
**RLS real por organización**, no con el `USING(true)` de `009`.

---

## 3. Ciclo de vida de una orden

```
draft ──▶ submitted ──▶ assigned ──▶ in_design ──▶ internal_review
             │  ▲                        ▲               │
             │  │                        │               ▼
             ▼  │                        └──────── client_review
         needs_info                                  │        │
                                     revision_requested       ▼
                                                           approved ──▶ delivered
```

Reglas que la máquina de estados hace cumplir (`lib/design/status.ts`,
cubiertas por tests):

- El cliente **no** puede saltarse la cola y poner su orden en diseño.
- Solo el cliente aprueba o pide cambios desde `client_review`. El estudio
  puede aprobar en su nombre (OK telefónico) y queda en la bitácora, pero
  **no** puede pedirse cambios a sí mismo.
- **`approved` no vuelve a diseño.** Ya está facturado; un cambio posterior
  es una orden nueva. Es la regla que corta la discusión más cara del
  rubro: *"yo ya lo aprobé" / "no, pediste otro cambio"*.
- Al cliente se le muestra "En proceso" para `assigned`, `in_design` e
  `internal_review`: no necesita ver la cocina del estudio.

---

## 4. Servicios del catálogo

Los 12 servicios de la lista viven en `lib/design/services.ts` y se siembran
en `price_catalog` con `category = 'Diseño Digital'` y `design_service_code`.
El precio lo pone cada estudio; lo que no cambia entre estudios son los
datos clínicos que cada servicio exige:

| Servicio | Cobro | Exige |
|---|---|---|
| Diseño de Modelo | arcada | arcada |
| Corona y Puente · Corona sobre Implante | unidad | piezas |
| Onlay / Inlay / Carilla | unidad | piezas |
| Diseño de Sonrisa · Encerado Digital | caso | piezas + fotos |
| Corona Atornillada | unidad | piezas |
| Pilar Personalizado sobre Implante | unidad | piezas |
| Estructura de Prótesis Parcial | arcada | arcada |
| Prótesis Parcial Acrílica (Flipper) | unidad | piezas |
| Cubeta Individual | arcada | arcada |
| Férula de Descarga / Protector Bucal | arcada | arcada |
| Prótesis Completa / Arcada Total | arcada | arcada + fotos |
| All-on-X / Arcada sobre Implantes | arcada | arcada + fotos |

**La compuerta de envío** (`lib/design/order-validation.ts`) es la pieza
con más retorno del módulo: el costo real del negocio no es diseñar, es el
ida y vuelta por casos que llegaron incompletos. Bloquea el envío si falta
el escaneo, las piezas o la arcada; y avisa sin bloquear qué suele faltar,
porque un `.zip` del escáner puede traerlo todo adentro y no hay forma de
saberlo sin abrirlo.

---

## 5. Estado de avance

### ✅ Fase 0 — Cimientos

| Archivo | Qué es |
|---|---|
| `scripts/035_design_studio.sql` | 5 tablas, 3 triggers, RLS real, bucket privado |
| `scripts/036_design_services_seed.sql` | siembra los 12 servicios en el catálogo del estudio |
| `lib/design/services.ts` | los 12 servicios + qué datos exige cada uno |
| `lib/design/status.ts` | máquina de estados y quién mueve qué |
| `lib/design/types.ts` · `files.ts` · `totals.ts` | tipos, formatos y rutas, totales |
| `lib/design/order-validation.ts` | compuerta de envío |
| `lib/design/access.ts` | de qué lado del mostrador está el usuario |
| `lib/permissions.ts` | 5 permisos nuevos + `DESIGN_STUDIO_PERMISSIONS` |

### ✅ Fase 1 — El circuito cierra de punta a punta

| Archivo | Qué es |
|---|---|
| `app/api/design/orders/route.ts` | listar y crear (precios resueltos en el servidor) |
| `app/api/design/orders/[id]/route.ts` | detalle, edición de borrador, descarte |
| `app/api/design/orders/[id]/status/route.ts` | **puerta única** de cambio de estado |
| `app/api/design/orders/[id]/files/route.ts` | subida y descarga por URL firmada |
| `lib/design/client-api.ts` | cliente con el flujo de subida en 3 pasos |
| `components/design/design-file-uploader.tsx` | uploader real, con progreso de red |
| `components/design/new-design-order-form.tsx` | el formulario de pedido |
| `components/design/design-orders-list.tsx` | listado para los dos lados |
| `components/design/design-order-detail.tsx` | detalle, acciones y bitácora |
| `app/dashboard/design/` | `page` · `new` · `[id]` · `loading` |

### ✅ Fase 2 — El lado del estudio

| Archivo | Qué es |
|---|---|
| `app/api/design/clients/` | alta por email y edición de la relación |
| `components/design/design-clients-section.tsx` | cartera de clientes |
| `components/design/design-queue-board.tsx` | tablero de la cola con asignación |
| `app/dashboard/design/queue` · `clients` | pantallas del estudio |

**Pendiente de la Fase 2:** notificaciones al cliente cuando la orden entra
en `client_review` o `needs_info`. Hoy se entera entrando al panel.

### ✅ Fase 3 — Facturación fina y números

| Archivo | Qué es |
|---|---|
| `lib/design/status.ts` → `resolveRevisionCharge()` | decide si la vuelta se cobra |
| `lib/design/services.ts` → `includedRevisionsForOrder()` | revisiones incluidas de una orden |
| `api/design/orders/[id]/status` | genera la línea de cargo al pedir cambios |
| `scripts/036_...` | siembra el arancel `revision_fee` |
| `lib/design/metrics.ts` | turnaround, puntualidad, faltantes, revisiones, margen |
| `components/design/design-analytics.tsx` | el tablero |
| `app/dashboard/design/analytics` | pantalla de análisis |
| `lib/design/pending.ts` + sidebar | contador de lo que espera tu acción |

**Cómo funciona el cargo por revisión.** Las revisiones incluidas de una
orden son las del servicio **más generoso** que contenga: cobrarle la
segunda vuelta porque la cubeta ya se pasó, en un trabajo que era
mayormente un All-on-X, sería una sorpresa en la factura. Pasada la cuota,
se agrega una línea `is_revision_fee` con el precio del arancel
`revision_fee`. **Si el estudio no le puso precio, no se cobra nada** y
queda una nota interna: facturar un número que nadie fijó es peor que
perder el cargo.

**El tablero.** Cada métrica viaja con su tamaño de muestra y avisa cuando
es chica: un 100% de puntualidad sobre 2 órdenes no sostiene una decisión.
Los tiempos son **mediana**, no promedio — un caso olvidado tres semanas
corre el promedio hasta que deja de describir a ningún caso real. La
puntualidad se mide contra la **primera** entrega: una vez que la pelota
pasó al cliente, el reloj del estudio se detiene.

### ✅ Fase 4 — Servicio de primera clase

Cerradas las cinco cosas que no funcionaban:

| Archivo | Qué resuelve |
|---|---|
| `components/design/design-studio-dashboard.tsx` + `-data.ts` | dashboard propio: abre con lo que pide acción hoy, no con totales |
| `app/dashboard/design/new/page.tsx` | el estudio carga órdenes en nombre de un cliente |
| `app/api/design/orders/route.ts` | la API acepta los dos lados y deriva el rol de la org, no del body |
| `app/api/design/clients/route.ts` | crea la cuenta si el email no existe, con enlace de acceso |
| `app/dashboard/billing/page.tsx` | rama del emisor generalizada: clientes y ítems según el tipo |
| `lib/money.ts` | USD para el estudio, ARS para el laboratorio |
| `lib/design/public-prices.ts` | la landing publica los precios del catálogo real |

**Puntos de diseño que vale la pena recordar:**

- **La API deriva el lado del mostrador de `org.type`, nunca del cuerpo.**
  Si confiara en lo que manda el cliente, cualquiera podría cargar órdenes
  como si fuera el estudio.
- **El estudio siempre elige cliente en el desplegable**, aunque tenga uno
  solo. Cargar una orden a nombre de otro sin verlo en pantalla es como se
  factura al cliente equivocado.
- **`formatNumber()` descartaba decimales** (`toFixed(0)`): US$ 12.99 se
  imprimía como $13. En un arancel con centavos eso no es un formato feo,
  es otro precio. Por eso la facturación pasó a `formatMoney`.
- **Los precios de la landing salen de `price_catalog`**, no de una
  constante. Publicar un precio en el código es como se termina cobrando
  distinto de lo que dice la web.
- **`getPublicDesignPrices` usa el cliente de servicio** a propósito: la
  RLS de `price_catalog` exige ser miembro, así que un visitante anónimo
  no veía ninguna fila. La consulta está acotada a dos columnas de
  aranceles activos — lo que el estudio quiere publicar y nada más.

**Verificado contra el sistema, no contra el código:** las 7 consultas del
dashboard corridas contra la base real (incluida la sintaxis `not.in` de
PostgREST), y el endpoint público ejercitado de punta a punta — orden
`DIS-000001` creada con cuenta, organización, relación en prepago e ítems
con precio resuelto en el servidor. Datos de prueba eliminados después.

### ✅ Fase 5 — Auditoría del módulo

Revisión línea por línea de las ~8.000 líneas del módulo. Nueve
hallazgos, todos corregidos y los de dinero verificados contra el
sistema real:

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | Prepago esquivable: `needs_info → submitted` entraba sin pagar | Puerta única: entrar a la cola exige factura paga, venga de donde venga |
| 2 | Revisión extra nunca se facturaba en prepago | Factura suplementaria `DIS-XXXXXX-R2` cuando la principal ya está paga |
| 3 | Los 5 permisos finos no se hacían cumplir en ninguna ruta | `requireDesignPermission()` en estado, archivos, edición y descarte |
| 4 | `needs_info → assigned` arrancaba trabajo sin pagar | Misma puerta que el 1 |
| 5 | Cancelar dejaba la factura pendiente para siempre | Se anula (`invoice_voided_at`), no se borra |
| 6 | `listUsers(1000)` en rutas públicas: "no existe" para el usuario 1001 | Intake: crear-y-atrapar duplicado. Alta: búsqueda paginada |
| 7 | Vuelta del checkout: "pendiente" sin explicación mientras llega el webhook | Banner "confirmando" + refresco automático |
| 8 | `delivered` dependía de un clic del estudio | La primera descarga del STL final marca la entrega |
| 9 | El cliente podía subir escaneos con el diseño en curso | Ventana: solo en `draft`, `needs_info`, `awaiting_payment` |

**La lección del 1 y el 4:** las dos versiones anteriores de la puerta de
pago miraban una transición concreta (`draft → submitted`). Cada estado
nuevo abría un camino que la esquivaba. La regla correcta no es "de dónde
viene" sino "¿entra a la cola y está pago?" — una sola pregunta, sin
importar la ruta.

### ⬜ Lo que queda

- **El `redirect_to` del enlace de acceso lo pisa Supabase.** Los enlaces
  de un solo uso vuelven con `redirect_to` apuntando al Site URL en vez de
  a `/auth/callback?next=/dashboard/design/<id>`. Hay que agregar las URLs
  a Authentication → URL Configuration → Redirect URLs en Supabase; hasta
  entonces el cliente entra pero cae en la home en vez de en su orden.
- **Notificaciones por email.** No hay proveedor instalado (`send-invoice`
  arrastra el `TODO` desde siempre). Por ahora el aviso es el contador en
  el menú, que cuenta solo lo accionable por vos para que llegue a cero y
  siga significando algo. `lib/design/pending.ts` tiene el criterio de a
  quién habría que escribirle cuando haya con qué.
- **Pasarela de pago para el modo `prepaid`.** `canClientDownload()` ya
  retiene el STL hasta que la factura esté paga; falta quién cobre.

---

## 5 bis. Qué se verificó, y cómo

La migración **no se pudo aplicar a Supabase** (ver sección 7), así que se
verificó contra un PostgreSQL 14 local con `auth` y `storage` simulados:

- **Aplica limpia** y es **idempotente**: dos corridas seguidas, mismo resultado.
- **Numeración**: `DIS-000001` generado por trigger.
- **Sellos de tiempo**: `submitted_at` y `first_delivery_at` se sellan una
  sola vez; la primera entrega no se pisa con las revisiones posteriores.
- **Contador de revisiones**: dos vueltas del cliente → `revision_count = 2`.
- **Facturación completa**: cubeta $1.500 + cargo por revisión $350 →
  factura de **$1.850**, con el detalle legible. No se duplica al seguir
  tocando la orden.
- **RLS con tres actores**: el estudio ve la orden y las 2 notas; el cliente
  ve la orden y **1 sola nota** (la interna queda oculta); un tercero ve
  **0 órdenes, 0 ítems, 0 archivos, 0 eventos** y no puede insertarse una
  orden a sí mismo.
- **Storage**: el objeto de la orden lo leen estudio y cliente; el tercero no.

**Dos bugs encontrados y corregidos en esas pruebas:**

1. El trigger borraba `approved_at` al avanzar de `approved` a `delivered`.
   La fecha de aprobación es un hecho histórico: perderla rompe la métrica
   "aprobación → entrega" y borra el respaldo de la factura. Ahora solo se
   limpia si la orden vuelve para atrás.
2. La factura salía con los **códigos internos** en el detalle
   (`impression_tray, revision_fee`) en vez de los nombres del catálogo.
   Eso lo ve el cliente. Ahora el trigger toma `price_catalog.name`:
   "Cubeta Individual, Revisión adicional".

**Tests:** 123 en verde (`pnpm test`), incluido un guard que hace fallar la
suite si el seed SQL y `services.ts` se desincronizan — verificado
rompiéndolo a propósito. `tsc --noEmit` y `pnpm build` sin errores.

## 6. Dos decisiones que te toca tomar

Elegí un camino por defecto para no frenarme, pero conviene que las
confirmes porque cambian el alcance de la Fase 3:

**a) ¿El estudio es una organización separada o un módulo del laboratorio?**
Asumí **organización separada** (`organizations.type = 'design_studio'`).
Es lo que permite que un laboratorio de la competencia sea cliente sin ver
nada del laboratorio propio. Si en realidad es un apartado interno de
DigitalDent, se simplifica bastante — pero cerrás la puerta a venderle a
otros labs.

**b) ¿Cuenta corriente o pago por adelantado?**
Asumí **cuenta corriente** (`payment_mode = 'account'`), que es lo que ya
sabe hacer el sistema. Dejé `'prepaid'` modelado y la compuerta
`is_released` lista para retener el STL hasta el pago, pero **no hay
pasarela de pago instalada** (ni Stripe ni Mercado Pago). Si vas a vender
online a desconocidos, eso es una fase propia.

---

## 7. Cómo aplicar la base

**La migración sigue sin aplicarse en Supabase.** El CLI de la máquina está
logueado con otra cuenta (solo ve el proyecto S360) y contra
`zmedkslwiyuvlvbktams` devuelve 403. Hay dos caminos:

**a) Autorizar el conector de Supabase** con la cuenta dueña del proyecto.
Entonces se aplica desde acá.

**b) A mano, como todas las anteriores**, desde el SQL Editor de Supabase,
en este orden:

1. `scripts/035_design_studio.sql` — el esquema. Termina verificando las 5
   tablas y el bucket, y levanta excepción si falta alguna.
2. Crear la organización del estudio:
   `INSERT INTO organizations (name, type) VALUES ('<nombre>', 'design_studio');`
3. `scripts/036_design_services_seed.sql` — **reemplazando antes** el UUID
   del principio por el de esa organización. Siembra los 12 servicios con
   precio 0; los precios se cargan desde Ajustes → Catálogo.
4. Habilitar el primer cliente desde Diseño Digital → Clientes, con el email
   de una cuenta que ya exista.
