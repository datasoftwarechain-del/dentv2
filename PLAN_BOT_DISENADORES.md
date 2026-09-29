# Bot de reparto de casos — Plan de desarrollo

Automatizar lo que hoy hace el moderador a mano: cuando entra un caso de
diseño, elegir al diseñador, mandárselo por correo, recibir el diseño
terminado, publicarlo en la plataforma y avisarle al cliente.

Parte de lo construido en `042_designers`: `design_applications` (los
diseñadores aprobados), `lib/email.ts` (Resend por HTTP),
`lib/design/case-email.ts` (el cuerpo del correo) y
`POST /api/design/orders/[id]/send-to-designer` (el envío manual). El bot
no reemplaza eso: lo llama.

---

## 1. Los cuatro hallazgos que condicionan el diseño

Antes de las fases, lo que se verificó en el código y en la base y obliga
a decidir algo. Ignorar cualquiera de estos cuatro hace que el bot no
funcione o que abra un agujero.

### 1.1 El diseñador no es un usuario: `assigned_to` no sirve

```
design_orders_assigned_to_fkey  FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
```

`design_applications` no crea usuarios de `auth`. El bot **no puede**
escribir a quién le mandó el caso en `assigned_to`. Hoy esa columna la
usan la cola (`/dashboard/design/queue`) y las métricas de carga
(`lib/design/metrics.ts`), así que dejarla vacía significa que el reparto
automático no aparece en ningún tablero.

**Decisión:** columna nueva `assigned_application_id` en `design_orders`
apuntando a `design_applications(id)`, y `metrics.ts` pasa a contar por
las dos. No se toca `assigned_to`: sigue siendo "qué persona del estudio
lo tiene", que es otra cosa.

### 1.2 El bot no tiene permitido mover ningún estado

```ts
export function nextStatuses(from, side) {
  if (side === "system") return [];   // lib/design/status.ts
  ...
}
```

El lado `system` existe en `ActorSide` y en la bitácora, pero la tabla de
transiciones no le da ninguna. El bot no puede pasar una orden a
`assigned` ni a `client_review`.

**Decisión:** agregar una fila `system` a `TRANSITIONS`, **deliberadamente
más corta que la del estudio**. El bot solo necesita cuatro movimientos:

| Desde | El bot puede ir a | Cuándo |
|---|---|---|
| `submitted` | `assigned` | mandó el caso a un diseñador |
| `assigned` | `in_design` | el diseñador confirmó que lo toma |
| `in_design` | `internal_review` o `client_review` | llegó el archivo terminado |
| `revision_requested` | `in_design` | re-despachó el pedido de cambios |

Cancelar, aprobar en nombre del cliente y pedir datos que faltan siguen
siendo humanos. Un bot que puede cancelar órdenes es un bot que algún día
cancela una orden.

### 1.3 El diseño terminado NO puede volver como adjunto de correo

`MAX_FILE_BYTES` del bucket es **500 MB** (`lib/design/files.ts`). El
límite práctico de un adjunto de correo está entre 25 y 40 MB según el
proveedor. Una arcada completa no entra, y las que entran llegan
recomprimidas por el camino.

**Decisión:** el diseñador **no responde con el archivo**. El correo lleva
un enlace a una página de entrega con token, y el archivo sube directo al
bucket con una signed upload URL, igual que sube hoy el estudio. Ventajas
sobre el correo entrante: sin límite de tamaño, sin parsear MIME, sin
depender de un proveedor de inbound, y el checksum se calcula del lado
del cliente antes de subir.

Esto además **elimina** la necesidad de contratar correo entrante
(Postmark Inbound, Mailgun Routes, Cloudflare Email Workers). Resend
saliente alcanza.

### 1.4 El cliente sí tiene cuenta: no hay que mandarle archivos

El cliente es una org (`design_client` o el laboratorio/clínica que pidió
el caso) y entra a `/dashboard/design`. El módulo firma las URLs a 5
minutos a propósito porque es dato clínico
(`SIGNED_URL_TTL_SECONDS = 300`).

**Decisión:** al cliente se le manda un **aviso con enlace a la
plataforma**, no el archivo ni un enlace firmado largo. Así el correo al
cliente no hereda la excepción de 72 h que sí necesita el correo al
diseñador (`CASE_EMAIL_LINK_TTL_SECONDS`), que no tiene cuenta.

---

## 2. Arquitectura en una pasada

```
        orden pasa a 'submitted'
                 │
     ┌───────────▼───────────┐
     │  disparador (2 vías)  │  webhook de base + cron de red de seguridad
     └───────────┬───────────┘
                 │
     ┌───────────▼───────────┐
     │   selector            │  especialidad · disponibilidad · carga · rotación
     └───────────┬───────────┘
                 │
     ┌───────────▼───────────┐
     │  despacho             │  fila en design_dispatches + token + correo
     └───────────┬───────────┘     orden → 'assigned'
                 │
        (el diseñador abre el enlace)
                 │
     ┌───────────▼───────────┐
     │  /d/entrega/<token>   │  acepta el caso → 'in_design'
     │                       │  sube el STL → design_order_files
     └───────────┬───────────┘
                 │
     ┌───────────▼───────────┐
     │  publicación          │  'internal_review' (con QC) o 'client_review'
     └───────────┬───────────┘
                 │
     ┌───────────▼───────────┐
     │  aviso al cliente     │  correo con enlace a la plataforma
     └───────────────────────┘
```

---

## 3. Fases

### Fase 0 — cerrar lo que quedó abierto (bloqueante)

No es parte del bot pero sin esto nada se puede probar.

1. Definir `RESEND_API_KEY` y `EMAIL_FROM` en el entorno del servidor y en
   Vercel. Verificar el dominio remitente (SPF y DKIM) o los correos caen
   en spam y el bot va a parecer roto.
2. Probar el envío manual con una postulación aprobada real.
3. Definir `DESIGN_STUDIO_ORG_ID` en producción. Hoy `resolveStudioOrgId()`
   funciona porque hay un solo estudio; el día que haya dos, falla cerrado.

**Se sabe que terminó cuando:** un caso real llega al correo de un
diseñador aprobado y los enlaces de descarga abren.

---

### Fase 1 — datos del reparto (migración 043) ✅ HECHA (2026-09-27)

Sin estado propio el bot no puede ser idempotente ni reintentar.

**Estado:** migración aplicada y verificada en prod. El índice único parcial
se probó de verdad: dos despachos simultáneos sobre el mismo caso, el
segundo rechazado; tras vencer el primero, el re-despacho entra. El lado
`system` de `TRANSITIONS` quedó abierto con sus cuatro movimientos y con
tests que fallan si alguien se los amplía. `metrics.ts` ya cuenta a los
externos y la tabla de análisis los marca. Al pasar, se corrigió un choque
de prefijos: las postulaciones eran `DIS-00001` y las órdenes de diseño
`DIS-000007`; ahora las postulaciones son `POS-00001`.

**`design_applications`** suma:

| Columna | Para qué |
|---|---|
| `is_available` bool default true | el diseñador se toma vacaciones |
| `max_concurrent` int default 3 | techo de casos simultáneos |
| `notify_email` text null | correo de trabajo si difiere del de postulación |
| `last_assigned_at` timestamptz | desempate por rotación |

**`design_dispatches`** (tabla nueva, el corazón del bot):

| Columna | Notas |
|---|---|
| `id`, `design_order_id`, `application_id` | a quién y para qué caso |
| `status` | `sent` · `accepted` · `declined` · `delivered` · `expired` · `failed` |
| `token_hash` | **hash** del token, nunca el token en claro |
| `token_expires_at` | vence; el reintento emite uno nuevo |
| `sent_at`, `accepted_at`, `delivered_at`, `expired_at` | línea de tiempo |
| `attempt` int | número de intento para este caso |
| `email_provider_id` | el id que devuelve Resend, para rastrear rebotes |
| `failure_reason` | por qué no salió |

Índice único parcial sobre `(design_order_id)` donde
`status IN ('sent','accepted')`: **un caso no puede estar despachado a dos
diseñadores a la vez**. Es la garantía de idempotencia: si el webhook y el
cron disparan juntos, el segundo choca contra el índice y no manda nada.

**`design_orders`** suma `assigned_application_id` (ver 1.1).

---

### Fase 2 — el selector ✅ HECHA (2026-09-28)

**Estado:** `lib/design/dispatch/select.ts`, función pura con 13 tests.
Verificado en prod: con dos diseñadores, uno con la especialidad del caso
y turno reciente y otro sin ella y turno viejo, eligió al especialista y
dejó escrito el porqué. **Cambio:** las especialidades que declara el
diseñador pasaron de texto libre inventado a las CATEGORÍAS reales del
catálogo (restaurador, implantes, removible, otros). Con las etiquetas
viejas el criterio nunca habría coincidido con nada y habría quedado
muerto sin que se notara.


Función pura en `lib/design/dispatch/select.ts`, sin efectos, testeable
con vitest (el proyecto ya tiene `vitest` configurado).

Entrada: la orden, los ítems, los diseñadores aprobados y sus despachos
abiertos. Salida: el elegido y **por qué**, que se guarda para poder
auditar un reparto raro.

Orden de filtros, cada uno descarta:

1. `status = 'approved'` y `is_available = true`
2. despachos abiertos `< max_concurrent`
3. si la orden tiene especialidad identificable por `service_code`, se
   prefiere a quien la declaró en `specialties`; si nadie la tiene, no se
   descarta a nadie (mejor asignado que trabado)

Desempate: `last_assigned_at` más antiguo. Es rotación pura y se entiende
sin documentación, que importa cuando un diseñador pregunte por qué le
llegan menos casos.

**Si no queda nadie:** la orden NO se mueve, se registra el intento y se
avisa al moderador. El caso queda visible en la cola como "sin diseñador
disponible". Nunca se manda a alguien fuera de criterio por no dejarlo
parado.

---

### Fase 3 — el disparador ✅ HECHA (2026-09-28)

**Estado:** `GET /api/bots/dispatch` (barrido, lo llama el cron) y
`POST` con `order_id` (lo llama el webhook de base). Secreto compartido
comparado en tiempo constante, exento de CSRF y de rate limit como los
webhooks de pago. `vercel.json` con el cron cada 10 minutos. Verificado en
prod: 401 sin secreto y con secreto incorrecto, barrido limpio, despacho
real con selección por especialidad, corte automático al tercer intento
(«El caso ya se intentó 3 veces. Lo toma el moderador.») y vencimiento que
libera la orden y lo asienta en la bitácora.

**Refactor:** la mecánica del despacho salió de la ruta del botón manual a
`lib/design/dispatch/run.ts`, compartida con el bot. Dos implementaciones
de «a quién se le manda un caso clínico y con qué credencial» era el peor
lugar para duplicar código.


Dos vías, a propósito redundantes, porque las dos fallan distinto.

**Vía principal: webhook de base de datos.** Supabase dispara a
`POST /api/bots/dispatch` cuando una orden entra a `submitted`. Es
inmediato. Se autentica con un secreto compartido en cabecera
(`BOT_WEBHOOK_SECRET`), comparado con `timingSafeEqual` como ya se hace en
las rutas de soporte. **No** lleva CSRF: lo manda un servidor, igual que
los webhooks de pago que `proxy.ts` ya exceptúa.

**Red de seguridad: cron.** `vercel.json` con un cron cada 10 minutos a
`POST /api/bots/dispatch?sweep=1`, que busca órdenes en `submitted` sin
despacho abierto y las reparte. Cubre el webhook que se perdió, el deploy
que estaba caído y el caso que entró por SQL. El índice único de la
Fase 1 hace que correr las dos vías juntas sea inofensivo.

El proyecto no tiene `vercel.json` todavía: esta fase lo crea.

**Además, el barrido vence despachos.** Un despacho en `sent` que pasó su
`token_expires_at` se marca `expired`, la orden vuelve a quedar
despachable y el siguiente barrido la manda a otro. Sin esto, un
diseñador que no abre el correo congela el caso para siempre.

---

### Fase 4 — la entrega del diseñador ✅ HECHA (2026-09-27)

**Estado:** probada de punta a punta contra producción con un despacho
real. El token abre el portal, aceptar mueve el despacho y estira el
vencimiento al techo de 14 días, la subida guarda el STL en el bucket con
`is_released = false`, el despacho queda `delivered` y el enlace deja de
abrir. Verificados además los tres rechazos: token inventado, subir sin
aceptar (409) y extensión prohibida (422). Todo lo que la prueba dejó en
prod se borró, salvo el objeto del bucket (ver más abajo).

**Cambio de contrato:** el despacho manual pasó de aceptar varios
destinatarios a aceptar uno solo. Lo obliga el índice único de la Fase 1, y
está bien que lo obligue: mandarle el mismo caso a tres personas significa
que dos van a trabajar gratis.

Ruta pública `/d/entrega/[token]`, sin cuenta. Lo que ve el diseñador:
el caso, los archivos del cliente, un botón para aceptar y un campo para
subir el diseño terminado.

Reglas, en orden de importancia:

1. **El token se guarda hasheado** y se compara en tiempo constante. Un
   volcado de la base no da acceso a ningún caso.
2. **El token es de un solo caso y un solo diseñador.** No da acceso a
   ninguna otra orden ni a la plataforma.
3. **La subida reusa `validateDesignFile()`** y el bucket existente con
   `kind = 'output_design'`. Sin excepciones nuevas de extensión ni de
   tamaño.
4. **Rate limit propio** en `proxy.ts`, más estricto que el de intake: el
   token es público y adivinarlo no debe ser barato.
5. Aceptar mueve la orden a `in_design` y marca `accepted_at`. Desde ahí
   el moderador ve en la cola que alguien lo está haciendo.

---

### Fase 5 — publicación y aviso al cliente ✅ HECHA (2026-09-28)

**Estado:** probada contra producción con una orden de prueba propia, en
los dos caminos. Con el interruptor apagado la orden va a
`internal_review` y el cliente no se entera; encendido va a
`client_review` y sale el aviso. El fallo de envío queda asentado en la
bitácora y NO deshace la entrega.

**Corrección al plan:** decía "si va a client_review, se libera el
archivo". **Está mal.** El entregable se libera recién cuando el cliente
APRUEBA (paso 6 de `/api/design/orders/[id]/status`); antes de eso el
cliente ve el caso pero no puede bajarse el STL, y saltearse eso pisaría
la compuerta de cobro del modo `prepaid`. La Fase 5 mueve el estado y
avisa; no toca `is_released`.

**Hallazgo:** `organizations.email` está vacío en las 54 organizaciones,
así que el aviso no habría encontrado a nadie. Se agregó un respaldo en
tres niveles (org → quien creó la orden → miembro de la organización) y
la bitácora asienta de cuál salió.

Al subirse el archivo:

1. Se registra en `design_order_files` como `output_design`, con
   `is_released` en **false** todavía.
2. La orden pasa a `internal_review` **o** a `client_review`, según un
   interruptor por estudio (`auto_release_designs`, en la fila de la org o
   en una tabla de ajustes).
3. Si va a `client_review`, se libera el archivo y sale el correo al
   cliente: qué caso, qué se terminó y un enlace a `/dashboard/design/[id]`.

**Recomendación fuerte: arrancar con el interruptor apagado**, o sea con
control interno. Durante las primeras semanas, un archivo que sube alguien
sin cuenta y llega solo al cliente es demasiado camino sin un par de ojos.
El interruptor existe para encenderlo cuando el flujo tenga historial, y
encenderlo es un cambio de una línea, no un desarrollo.

**El bucle de revisión:** si el cliente pide cambios, la orden va a
`revision_requested` y el bot re-despacha **al mismo diseñador** (nuevo
token, mismo `application_id`), porque ya tiene el contexto del caso. Solo
si ese diseñador dejó de estar disponible se elige otro.

---

### Fase 6 — que no falle en silencio

Lo que separa un bot de un script que anduvo una vez.

- **Rebotes.** Guardar `email_provider_id` y atender el webhook de Resend:
  un correo rebotado marca el despacho `failed` y libera el caso para
  re-despacho. Hoy un rebote sería invisible.
- **Bandeja de excepciones** en el panel del estudio: casos sin diseñador,
  despachos vencidos, envíos fallidos. Es la pantalla que se mira cuando
  algo no llegó.
- **Bitácora completa.** Cada acción del bot deja un `design_order_events`
  con `actor_side = 'system'`. La columna ya existe y hoy no la usa nadie.
- **Interruptor general** (`BOT_DISPATCH_ENABLED`). Cuando algo salga mal
  a las once de la noche, hay que poder apagarlo sin un deploy.
- **Tests** del selector y del vencimiento de tokens con vitest. Son
  funciones puras: no hay excusa para no tenerlos.

---

## 4. Orden de trabajo sugerido

| # | Fase | Depende de | Entrega algo usable |
|---|---|---|---|
| 1 | Fase 0 | — | sí: el envío manual empieza a funcionar |
| 2 | Fase 1 | 0 | no: solo esquema |
| 3 | Fase 4 | 1 | sí: entrega por token con despacho manual |
| 4 | Fase 2 | 1 | no: selector aislado con tests |
| 5 | Fase 3 | 2, 4 | sí: el bot anda de punta a punta |
| 6 | Fase 5 | 3 | sí: el cliente se entera solo |
| 7 | Fase 6 | 5 | sí: se puede dejar corriendo sin mirarlo |

Poner la Fase 4 antes que la 2 no es un error: **la entrega por token es
lo que más valor da y lo que más riesgo tiene**. Conviene tenerla andando
con reparto manual, y recién cuando esté probada automatizar quién recibe.

---

## 5. Decisiones resueltas

Las cuatro que quedaban abiertas, cerradas con un valor concreto. Todas
viven en constantes de `lib/design/dispatch/policy.ts`, en un solo lugar,
para poder moverlas sin buscarlas por el código.

### 5.1 Vencimiento del token

Dos relojes distintos, porque son dos riesgos distintos.

| Momento | Valor | Por qué |
|---|---|---|
| Para **aceptar** el caso | 48 h desde el envío | un caso parado dos días ya es un problema de servicio |
| Una vez **aceptado** | hasta la fecha límite del caso + 48 h | el diseñador necesita el enlace todo el tiempo que dure el trabajo |
| Sin fecha límite en la orden | 14 días desde que aceptó | techo duro para que ningún token viva para siempre |

El token se renueva, no se extiende: cada re-despacho emite uno nuevo y el
anterior queda `expired`. Un token viejo nunca vuelve a servir.

### 5.2 Qué pasa si el diseñador no responde

Escalera de tres pasos, medida desde `sent_at`:

| Momento | Acción |
|---|---|
| 24 h | recordatorio por correo al mismo diseñador |
| 48 h | el despacho vence, la orden queda libre y se re-despacha al siguiente |
| 3 intentos fallidos sobre el mismo caso | se corta el reparto automático y salta a la bandeja de excepciones del moderador |

El corte a los tres intentos es lo importante. Sin él, un caso que nadie
puede tomar (porque le falta un archivo, por ejemplo) rota entre todos los
diseñadores mandando correos para siempre.

Los casos con `priority = 'urgent'` corren con la mitad de los tiempos:
recordatorio a las 12 h, vencimiento a las 24 h.

### 5.3 Pago a los diseñadores

**Se modela el dato ahora, no se construye la liquidación.** Es una
decisión de negocio que no está tomada y construirla a ciegas es tirar
trabajo.

Lo que sí entra en la migración 043, porque después duele agregarlo:
`design_applications.rate_per_case` (numeric, nullable) y
`design_dispatches.delivered_at`. Con esas dos columnas, el día que se
encare la liquidación, el histórico ya está completo y se puede pagar
hacia atrás. Sin ellas habría que reconstruirlo a mano.

Queda **fuera**: moneda por diseñador, tarifas por tipo de trabajo,
retenciones, y la pantalla de liquidación.

### 5.4 El P0 de RLS

**No bloquea este bot y no se toca acá.** La policy de `lab_orders` es
`USING(true)` para cualquier autenticado, pero los diseñadores no tienen
cuenta, así que no hay superficie nueva. Es la razón por la que el modelo
es por correo y no por cuentas, y así queda anotado.

Se arregla en su propia rama, con su propio plan, y es requisito previo
para cualquier futuro en que los diseñadores tengan usuario. Meterlo acá
mezclaría un cambio de seguridad transversal con una función nueva, y las
dos cosas necesitan revisarse distinto.
