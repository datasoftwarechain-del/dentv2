# Sección "Servicios" de la landing · diseño, fresado e impresión

Rama `feature/servicios-cards`. Integra la sección diseñada en Claude Design
(variante A, paleta clara, Inter) y le da flujo real a cada card.

## Qué hace cada card

| Bloque | Card | Destino | Qué pasa |
|---|---|---|---|
| 01 · Diseño digital (global, 12 servicios) | cada servicio de `lib/design/services.ts` | `/disenos/solicitar?servicio=<code>` | Flujo existente del estudio de diseño (037): cuenta `design_client`, orden en `draft`, pago previo. El código de la URL **preselecciona** el servicio solo si existe en el catálogo. |
| 02 · Fresado CAM (Uruguay) | zirconio · zirconio-fx · disilicato · pmma · fresado-stl | `/fresado/solicitar?producto=<key>` | **Solicitud** (`lab_requests`), sin cuenta. El laboratorio la convierte en `lab_orders` desde su bandeja. |
| 03 · Impresión 3D (Uruguay) | modelos · provisorio-flex | `/fresado/solicitar?producto=<key>` | Ídem. |

Fuera de Uruguay, fresado/impresión no se envía: el formulario muestra el
aviso y deriva al diseño digital. El API devuelve `422 {code:"out_of_scope"}`.

## Mapeo producto → catálogo → orden

`lib/lab-requests/products.ts` es la única fuente. Cada `product_key`
apunta al ítem de `price_catalog` **por nombre exacto** y sugiere un
`work_type` del enum de `lab_order_items` (el laboratorio lo puede cambiar
al convertir):

| key | ítem de catálogo (nombre exacto) | work_type sugerido | archivo |
|---|---|---|---|
| zirconio | Zirconio | corona_zirconia | opcional |
| zirconio-fx | ZIRCONIO FX | corona_zirconia | opcional |
| disilicato | Disilicato de litio o Feldespato | corona_emax | opcional |
| pmma | PMMA | otro | opcional |
| fresado-stl | Fresado de STL | otro | **obligatorio** (o nº de caso) |
| modelos | MODELOS IMPRESOS | otro | opcional (no pide piezas ni color) |
| provisorio-flex | PROVISORIO FLEX (Hasta 4 piezas) | otro | opcional |

`test/lab-requests.test.ts` verifica que las cards de `content/servicios.ts`
y este mapa digan el mismo nombre de catálogo: si alguien renombra un ítem
en un lado, el test falla.

Precios: los de las cards y los del formulario salen del catálogo real
(`getPublicLabPrices`, org "Digital Dent"). Los que están en 0 (PMMA,
MODELOS IMPRESOS) se muestran **"A cotizar"**, nunca "$0".

## Flujo de una solicitud de fresado

```
landing card ─► /fresado/solicitar?producto=zirconio
   │  formulario (sin cuenta, honeypot, términos, idempotency_key)
   ▼
POST /api/lab-requests  ── 422 si país ≠ UY / producto inválido / sin STL en fresado-stl
   │  inserta lab_requests (service role), status pending_review
   │  si declaró archivo: URL firmada de subida (bucket privado lab-request-files)
   ▼
PUT  <signed_url>  (XHR, progreso real)
PATCH /api/lab-requests/{id}/file  ── el servidor lista el bucket y recién ahí marca uploaded
   │
   ▼
Bandeja /dashboard/lab-requests (solo orgs 'lab')
   ├─ Descargar (URL firmada 5 min)
   ├─ Rechazar  → status rejected (+ motivo)
   └─ Convertir en orden
        clínica existente (lab_dentist_relations) o nueva (organizations type=dentist)
        → lab_orders (status received, ORDEN N) + lab_order_items (work_type, catálogo, precio)
        → copia del STL a case-files/{orderId}/ + fila en case_files
        → lab_requests.status = converted, lab_order_id
```

### Garantías
- **Idempotencia**: `idempotency_key` UNIQUE (doble clic = misma solicitud);
  la conversión toma un cerrojo `pending_review → converting` (doble clic = 409).
- **Nada se pierde en silencio**: si la subida falla, la solicitud queda con
  `file_status='pending'` ("Archivo no llegó") y el formulario ofrece reintentar.
- **Anti-spam**: honeypot `website` + rate limit 3/min por IP en `proxy.ts`.
- **Privacidad**: no se pide nombre de paciente (solo `patient_ref`); el bucket
  es privado; los logs guardan número de solicitud, no contenido.
- **Precios y colaboradores**: la bandeja solo manda montos si
  `view_prices`; convertir exige `create_orders`, rechazar `edit_orders`.

## Base de datos

`scripts/040_lab_requests.sql` (idempotente, sin `DO`). Requiere 035
(`is_org_member`). Probado en Postgres 14 local: numeración, idempotencia,
CHECKs, sello `reviewed_at`, RLS por laboratorio, policy del bucket.

Para aplicar: SQL Editor de Supabase → pegar → debe devolver
`tabla_creada=1, policies=2, bucket_privado=1`.

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `LAB_INTAKE_ORG_ID` | servidor (Vercel) | UUID de la org `lab` que recibe las solicitudes. Opcional: si falta, se usa la org `lab` cuyo nombre empieza con "Digital Dent" (mismo criterio que los precios públicos). En prod: `b0c9ccc3-e8b6-4264-9508-1d1e94b8abb8`. |

Ninguna clave nueva en el frontend. Las que ya existían (Supabase, PayPal,
Mercado Pago) siguen en `.env.example`.

## Archivos

```
content/servicios.ts                      textos de la sección (sin lógica)
components/landing/servicios/*            sección, coverflow, cards, chips de alcance
public/servicios/*.png                    imágenes del diseño
lib/lab-requests/{products,country,files,status,types,convert,lab-org,access,client-api}.ts
app/api/lab-requests/route.ts             POST público
app/api/lab-requests/[id]/file/route.ts   PATCH confirmación de subida (público)
app/api/lab-requests/[id]/route.ts        GET detalle+descarga · PATCH rechazo (lab)
app/api/lab-requests/[id]/convert/route.ts POST convertir (lab)
app/fresado/solicitar/page.tsx + components/lab-requests/lab-request-form.tsx
app/dashboard/lab-requests/page.tsx + components/lab-requests/lab-requests-inbox.tsx
scripts/040_lab_requests.sql
test/lab-requests.test.ts
```

## Deuda y decisiones conocidas
- `case-files` (bucket de "Casos Digitales") es **público** desde antes de
  este trabajo; el STL se copia ahí al convertir para que el caso se vea
  como cualquier otro. El original queda en el bucket privado.
- La numeración `ORDEN N` se calcula como en el diálogo de nueva orden
  (máximo + 1 sobre las últimas 100): dos conversiones en el mismo
  milisegundo podrían chocar. Es el comportamiento preexistente.
- No hay páginas de términos/privacidad (el footer apunta a `#`); el
  checkbox no enlaza a nada hasta que existan.
- No hay envío de email al profesional ni al laboratorio: no existe
  proveedor de email configurado en el proyecto.
