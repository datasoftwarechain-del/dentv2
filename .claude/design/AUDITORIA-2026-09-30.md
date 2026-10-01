# Auditoría completa — DigitalDent v2 · 2026-09-30

Alcance pedido por el owner: **estado + funcional + seguridad**, en un solo informe priorizado.
Método: Read/Grep directo sobre el árbol, sin subagentes, y **verificación contra el sistema**
(base de producción vía MCP, HTTP contra los deploys, `pnpm audit`, `tsc`, `vitest`).
Cada hallazgo dice cómo se midió. Lo que no se pudo medir está marcado como tal.

- Rama auditada: `main` = `5b15479`, árbol limpio, sincronizada con origin.
- Gate del repo hoy: **`tsc --noEmit` exit 0 · `vitest` 202/202 en verde** (medido, no leído).
- Proyecto Supabase: `zmedkslwiyuvlvbktams` (org Dent, sa-east-1). 30 tablas en `public`.
- Proyecto Vercel: `v0-dentv2` (`prj_HoVvlmNT7CBFTiEOoLCgNDAMoNre`).

---

## P0 — Urgente

### 1. Next.js 16.1.6 con dos CVE críticos de ejecución remota sin autenticar
`pnpm audit`: **109 vulnerabilidades — 3 críticas, 51 altas, 46 moderadas, 9 bajas.**
Dos de las críticas son de Next: *"Unauthenticated Remote Code Execution"*, rango vulnerable
`>=16.0.0 <16.3.3`. Instalado y declarado: **16.1.6**. Parche: **≥16.3.3**; última 16.x: 16.3.7.

Entre las 12 altas de Next hay cuatro *"Middleware / Proxy bypass in App Router"*. Acá eso importa
porque `proxy.ts` es quien emite la cookie CSRF y aplica **todos** los rate limits (auth 10/min,
API 120/min, intakes públicos, portal de entrega).

Atenuante verificado: la autenticación del dashboard **no** depende solo del proxy.
`app/dashboard/layout.tsx:16` llama `getUserOrg()`, que redirige a `/auth/login` sin usuario, y
cubre a todas las páginas hijas (incluida `/dashboard/support`, la única que no lo llama por su
cuenta). `validateCSRF` también falla cerrado si no hay cookie. El impacto práctico de un bypass
de proxy queda en **perder los rate limits**, no en abrir el dashboard.

> Acción: subir a `next@16.3.7`. Es un salto menor (16.1 → 16.3) pero toca el runtime;
> merece su propia lane con build + suite completa.

### 2. RLS `USING(true)` en seis tablas de producción — cualquiera que se registre lee todo
Medido contra prod con `pg_policy`, no leyendo los scripts. Seis tablas con RLS **habilitada**
pero con políticas que no filtran nada, para el rol `authenticated`:

| Tabla | Política | cmd | USING | WITH CHECK |
|---|---|---|---|---|
| `patients` | `allow_all_on_patients` | ALL | `true` | `true` |
| `lab_orders` | `allow_all_on_orders` | ALL | `true` | `true` |
| `lab_order_items` | `allow_all_on_order_items` | ALL | `true` | `true` |
| `organizations` | `allow_all_on_organizations` | ALL | `true` | `true` |
| `lab_dentist_relations` | `allow_all_on_relations` | ALL | `true` | `true` |
| `client_invitations` | 4 políticas separadas (r/a/w/d) | — | `true` | `true` |

**Son seis, no cinco** como decía la nota anterior.

Lo que queda expuesto, contado en prod:
- **534 pacientes de 39 clínicas distintas** — `first_name`, `last_name`, `email`, `phone`,
  `date_of_birth`, `notes`. Dato clínico identificable.
- **573 órdenes** y **718 ítems con precios** (`unit_price`, `unit_cost`, `selected_extras`).
- **54 organizaciones** con `tax_id`, dirección y teléfono.
- 45 relaciones lab↔clínica. Y `WITH CHECK(true)` significa que también se puede **escribir**.

La puerta está abierta: `app/auth/sign-up/page.tsx:59` hace `supabase.auth.signUp()` **público y
sin gate de aprobación** (grep de `pending_approval`/`approvals`: cero resultados — a diferencia
de S360, que sí tiene ese gate). Cualquiera se registra y obtiene el rol `authenticated`.

No hace falta ni usar la app: **27 archivos** consultan estas tablas desde el navegador con la
clave anon (`components/cases/cases-view.tsx`, `components/orders/orders-list.tsx`,
`components/kanban/kanban-board.tsx`, `components/dashboard/create-patient-dialog.tsx` que además
**inserta**, etc.), así que la superficie REST ya está publicada al cliente.

Control medido: **sin sesión** (rol `anon`) `GET /rest/v1/patients` devuelve `[]` — las políticas
no incluyen a `anon`. El requisito es *una* cuenta, cualquiera.

### 3. Funciones SECURITY DEFINER ejecutables por `anon` — fuga y escritura sin login. PROBADO
14 funciones `SECURITY DEFINER` tienen `EXECUTE` concedido a `anon` y son alcanzables por
`/rest/v1/rpc/`. Al ser SECURITY DEFINER **saltean la RLS**. Verificado con
`has_function_privilege('anon', …)` y con HTTP real usando la clave pública, sin sesión:

```
POST /rest/v1/rpc/get_user_orgs   {"uid":"935f32b0-…"}
→ 200 [{"org_id":"3c09d16b-…","org_type":"dentist","role":"owner"}]

GET  /rest/v1/org_members?select=org_id,role      (control, misma llamada sin la función)
→ 200 []
```

La consulta directa a `org_members` la corta la RLS; la función la devuelve. Es un bypass
demostrado de divulgación de información sin autenticar.

Las dos que más preocupan, ambas con `p_lab_org_id uuid` arbitrario y `anon_puede = true`:
- `verify_billing_integrity(uuid)` — **lee** números de orden y problemas de facturación de
  cualquier laboratorio. Probado: responde `200` sin sesión (hoy devuelve `[]` porque no hay
  inconsistencias, así que no hay fuga de datos *hoy*, pero el endpoint está abierto).
- `repair_missing_invoices(uuid)` — **crea facturas** para cualquier laboratorio.
  **NO la invoqué**: escribe. El grant a `anon` está confirmado por privilegio.

También `user_belongs_to_org(uid, oid)` es un oráculo de membresía abierto, y `search_labs(text)`.
Además hay **6 vistas** `SECURITY DEFINER` (`lab_dashboard_stats`, `lab_billing_health`,
`lab_late_deliveries`, `active_organizations`, `client_records`, `invoices_complete`) — nivel ERROR
en el linter de Supabase.

> Acción mínima e inmediata, sin tocar la app:
> `REVOKE EXECUTE ON FUNCTION public.<f> FROM anon;` en las 14. Las que el app llama desde el
> servidor usan service role y no pierden nada. `repair_missing_invoices` debería además exigir
> membresía adentro.

---

## P1 — Alto

### 4. Producción NO tiene el merge del 29-09. Está corriendo un build de ~25-09
Medido por HTTP contra `v0-dentv2.vercel.app` (alias del proyecto = producción), con caché
baypasseada (`?cb=` + `Cache-Control: no-cache`):

| Ruta | En `main` desde | En prod |
|---|---|---|
| `/fresado/solicitar` | `00dd80a` 24-09 | **200** |
| `/disenos/solicitar` | `2a27f8a` 23-09 | **200** |
| `/disenadores` | `d3ef8c6` 27-09 | **404** |
| `/api/bots/dispatch` | `1836d0f` 29-09 | **404** (debería ser 401 sin secreto) |
| `/d/entrega/[token]` | `fd49ac4` 29-09 | **404** |

La cabecera del home traía `age: 430084` (≈5 días). Conclusión: el deploy vivo está entre
`00dd80a` (24-09) y `d3ef8c6` (27-09). **Todo "equipo de diseño + bot de reparto" (merge `5b15479`,
15 commits, pusheado el 29-09) y el fix de saldo pendiente `1ccac41` no están en producción.**

No pude leer el estado del deploy en Vercel (el MCP pide autenticación), así que la **causa**
—auto-deploy apagado, build fallido, o rama de producción distinta— hay que confirmarla en el
panel. El hecho de que no está desplegado sí está medido.

Nota aparte: `dentv2.vercel.app` sirve otra aplicación ("Smart DentalOps", SPA de Vite que
responde 200 a todo) y `v0-dentv2.vercel.app` es el alias correcto. No confundirlos al probar.

### 5. La captación de leads de la landing está rota desde el 27-02 — la tabla no existe
`app/api/leads/route.ts:27` hace `upsert` en `public_leads`. En prod:
`information_schema.tables` → **`public_leads` no existe**. La migración
`supabase/migrations/20260227_create_public_leads.sql` nunca se aplicó.

La llaman `components/landing/newsletter.tsx:43` y `components/landing/chat-widget.tsx:47`.
Todo lead entrado por el newsletter o el chat de la landing devolvió **500** y se perdió.
El visitante ve "Error al guardar tu información", el owner no ve nada (ver #7).

### 6. El bucket `case-files` es PÚBLICO
`storage.buckets`: `case-files` tiene `public = true`, sin límite de tamaño ni de MIME. Los otros
dos son privados (`design-files` 500 MB, `lab-request-files` 200 MB). Son los archivos clínicos
adjuntos a las órdenes de laboratorio: legibles por URL sin sesión y sin URL firmada.

Daño actual bajo: **1 solo objeto** en el bucket (de 2026-02-21). Es una bomba de tiempo, no un
incendio: en cuanto las clínicas empiecen a adjuntar, todo queda abierto. Contrasta con el módulo
de diseño, que firma a 5 minutos justamente por ser dato clínico.

### 7. `logger.error` no escribe en producción — 62 sitios de error mudos
`lib/logger.ts:2` define `isDev = NODE_ENV === "development"` y `log`/`error`/`warn`/`info`
**solo emiten si `isDev`**. Únicamente `logger.security()` escribe siempre.

Hay **62 llamadas a `logger.error`** en `app/`, `lib/` y `components/` que en producción no dejan
rastro (y 40 `console.error` que sí). Esta es la causa estructural de los fallos silenciosos que
ya aparecieron: el aviso al cliente que "habría fallado siempre y en silencio" porque
`organizations.email` está vacío, el 500 de `/api/leads`, los errores de storage. Vercel captura
el stdout de las funciones; suprimirlo es tirar el único telescopio que hay.

> Acción: que `error` y `warn` escriban siempre. `log`/`info` pueden quedar en dev.

### 8. La metadata del sitio apunta a otro producto homónimo
`https://digitaldent.app` **no es esta aplicación**: es una DigitalDent alemana servida por
Cloudflare, `<title>DigitalDent – Die digitale Arbeitsplattform für Dentallabore</title>`, con un
404 en alemán y bundles de TanStack Router. Sin embargo el app declara:

- `<link rel="canonical" href="https://digitaldent.app">` → le dice a Google que el contenido
  canónico vive en el sitio del otro.
- `og:url` y `og:image` → `https://digitaldent.app/og-image.png`, que da **404** (también da 404
  en el deploy propio). Toda tarjeta compartida sale sin imagen.
- `robots.txt` → `Sitemap: https://digitaldent.app/sitemap.xml`.

---

## P2 — Medio

### 9. `.env` está versionado en git
`git ls-files --error-unmatch .env` → está trackeado, aunque `.gitignore:24` lo lista (gitignore
no destrackea lo ya trackeado). Hoy solo contiene `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, que son públicas por diseño, así que **no hay filtración**.
Es una trampa: el día que alguien agregue `SUPABASE_SERVICE_ROLE_KEY` ahí en vez de `.env.local`,
se commitea. `git rm --cached .env`.

### 10. `.env.example` documenta 10 de las 21 variables que el código usa
Grep de `process.env.*` en `app/`, `lib/`, `components/`, `hooks/`, `proxy.ts`: **21 variables**.
`.env.example` tiene 10. **Faltan 11**, entre ellas las que deciden si una feature vive o muere:

`RESEND_API_KEY` · `EMAIL_FROM` · `BOT_WEBHOOK_SECRET` · `BOT_DISPATCH_ENABLED` ·
`SUPABASE_SERVICE_ROLE_KEY` · `SUPPORT_ADMIN_EMAIL` · `NEXT_PUBLIC_SITE_URL` ·
`NEXT_PUBLIC_WHATSAPP_NUMBER` · `DESIGN_STUDIO_ORG_ID` · `LAB_INTAKE_ORG_ID` ·
`NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`

No pude leer el entorno de Vercel (MCP sin autenticar), así que **qué está definido en prod queda
sin verificar**. Lo que sí se verificó: los dos resolvers de org tienen respaldo y funcionan sin
sus variables — `resolveIntakeLabOrgId` cae en `ilike 'digital dent%'` y matchea la org
`"Digital Dent "` (`b0c9ccc3-…`); `resolveStudioOrgId` cae en la única `design_studio`
(`c158401f-…`). Los intakes públicos no dependen de esas dos variables.

### 11. El cron de Vercel no puede autenticarse contra su propia ruta
`vercel.json` programa `GET /api/bots/dispatch` cada 10 minutos. La ruta
(`app/api/bots/dispatch/route.ts:52-55`) acepta el secreto por `x-bot-secret` o por
`authorization: Bearer …`, comparado contra `BOT_WEBHOOK_SECRET` con `timingSafeEqual`.

Los cron de Vercel no mandan `x-bot-secret`: mandan `Authorization: Bearer $CRON_SECRET`, y solo
si `CRON_SECRET` está definida. **`CRON_SECRET` no aparece en ningún archivo del repo** (grep en
todo el árbol: cero). Si no se define `CRON_SECRET` con **el mismo valor** que
`BOT_WEBHOOK_SECRET`, el barrido devuelve 401 cada 10 minutos para siempre — y el barrido es justo
la pata que cubre "el webhook perdido, el deploy caído y el caso que entró por SQL".

El guardián en sí está bien hecho: **falla cerrado** si falta el secreto del servidor.

### 12. Dos ledgers de migraciones en paralelo, sin fuente única de verdad
- `scripts/NNN_*.sql` — **46 archivos** numerados (022…043), aplicados a mano en el editor SQL.
- `supabase/migrations/YYYYMMDD_*.sql` — 4 archivos.
- `supabase_migrations.schema_migrations` en prod — **3 filas**: `042_designers`,
  `043_dispatch`, `043b_fix_application_prefix`.

O sea: de 50 archivos de migración, el ledger del CLI conoce 3. No hay forma de saber qué está
aplicado sin ir a mirar el schema. Esto ya produjo el hallazgo #5. Verificado que sí están
aplicadas: `lab_requests` (040), `design_applications` (042), `design_dispatches` +
`design_orders.assigned_application_id` (043).

### 13. Dos páginas de scratch de desarrollo, públicas e indexables
`/test/curved-loop` y `/test/user-dropdown` responden **200** en producción.
`robots.txt` solo bloquea `/dashboard/` y `/api/`, así que están permitidas para los crawlers.

---

## P3 — Bajo / deuda

14. **`invoices.status` no significa cobro.** En prod: `pending: 482`, `cancelled: 11`,
    **`paid: 0`**. Ninguna factura se marca paga nunca; los pagos viven en `ledger_movements`.
    Las pantallas ya se corrigieron (`computeAccountBalance`), pero la columna sigue siendo una
    trampa para cualquier consulta nueva. Las facturas a pacientes sí se cuentan por status a
    propósito (no hay dimensión de paciente en el libro mayor).
15. **`organizations.email` vacío en las 54 orgs.** Nadie lo carga. Todo camino de correo hacia
    una org depende del respaldo en tres niveles.
16. **El bot no tiene a quién repartir.** `design_applications`: 1 `pending_review`, **0
    `approved`**. Aunque se configure `RESEND_API_KEY`, el selector no encontraría candidatos.
    Este es el bloqueante real, antes que la clave.
17. **4 objetos huérfanos de prueba** en `design-files`, 145 bytes cada uno, sin fila en
    `design_order_files`: `05255462-…/output_design/1-diseno-prueba.stl` y tres
    `0689b94d-…/output_design/{1-fase5,2-fase5-v2,3-fase5-v3}.stl`. No se borran por SQL
    (`storage.protect_delete()`); van por el panel o la Storage API con service role.
18. **`"Digital Dent "`** tiene un espacio al final en `organizations.name`. Se ve en la UI.
19. **Nombre de paciente en la ruta de storage:**
    `…/input_scan/1-Carlos_Lion_36_BiteScan.ply`. Las rutas viajan en logs y URLs firmadas.
20. **"Enviar por email" en facturación sigue sin cablear.**
    `components/billing/invoice-actions.tsx:165` muestra un honesto
    `toast.info("Funcionalidad de email en desarrollo…")` y el `fetch` está comentado — **la UI no
    miente**. Pero `/api/billing/send-invoice` devuelve `{success: true, message: "Factura enviada
    por email"}` después de un solo `console.log`, sin enviar nada: es una trampa para quien
    descomente el fetch. Y ahora existe `lib/email.ts` (Resend) que nadie conectó acá.
21. **`NEXT_PUBLIC_WHATSAPP_NUMBER` sin definir** → `components/dashboard/sidebar.tsx:457`
    renderiza `https://wa.me/` (vacío) y `components/support/whatsapp-button.tsx:5` queda en `""`.
22. **33 funciones con `search_path` mutable** y **protección de contraseñas filtradas apagada**
    en Auth (linter de Supabase, nivel WARN).
23. **No hay CLAUDE.md ni doc de protocolo en este repo** (S360 sí). Hay **20 archivos `.md`
    sueltos en la raíz** sin jerarquía, incluido un `AUDIT_REPORT.md` del 2026-03-11.

---

## Lo que está bien hecho (para no romperlo)

- **La capa API es sólida.** 54 rutas; las mutaciones llevan CSRF doble-cookie, Zod, y resolución
  de acceso por helper (`getUserOrg`, `resolveDesignAccess`, `resolveLabRequestAccess`).
- **Todos los comparadores de secretos fallan cerrados** cuando falta la variable de entorno:
  `bots/dispatch`, los tres `support/admin/*`, `lib/csrf.ts`, `lib/design/dispatch/token.ts`,
  `lib/payments/mercadopago.ts`. Verificado leyendo cada uno.
- **Defensa en profundidad real** en el dashboard: el layout llama `getUserOrg()` y 100% de las
  páginas quedan cubiertas.
- **Las pasarelas de pago degradan con elegancia** (`lib/payments/index.ts`: un proveedor se
  ofrece solo si `isConfigured()`), y `lib/email.ts` devuelve un motivo legible en vez de un 500.
- **El token del portal de entrega se guarda hasheado** (sha256) y se busca por hash.
- `PATCH /api/lab-requests/[id]/file` es públicamente alcanzable **a propósito** y está bien
  razonada: exige conocer el UUID, exige la ruta exacta que emitió el servidor, exige
  `status='pending_review'`, y verifica contra el bucket que el objeto exista. Su único efecto es
  poner `file_status='uploaded'`.
- **Gate del repo en verde**: `tsc` 0 errores, 202/202 tests.

---

## Orden sugerido

| # | Qué | Por qué primero |
|---|---|---|
| 1 | `REVOKE EXECUTE … FROM anon` en las 14 funciones (#3) | Una sentencia SQL, sin tocar la app, cierra una fuga probada sin login |
| 2 | Subir a `next@16.3.7` (#1) | RCE sin autenticar. Necesita su lane con build + suite |
| 3 | Averiguar por qué prod no tiene `5b15479` (#4) | Todo lo demás que arregles no llega a producción |
| 4 | Aplicar `public_leads` (#5) | Una migración; destapa la captación de leads |
| 5 | Que `logger.error` escriba en prod (#7) | Sin esto seguís operando a ciegas |
| 6 | RLS real en las 6 tablas (#2) | Es el más grande y el más invasivo: cada política necesita su prueba contra prod antes y después. Tiene 27 archivos de cliente encima |
| 7 | `case-files` a privado + URLs firmadas (#6) | Hoy 1 objeto: es el momento más barato para hacerlo |

El orden pone la RLS sexto **no** porque importe menos —es el hallazgo más grave junto al RCE—
sino porque es el único que puede vaciar pantallas si se hace sin medir. Los cinco de arriba son
cambios chicos y verificables; ese necesita una lane propia con baseline capturado.
