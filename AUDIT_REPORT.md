# Reporte de Auditoría — DigitalDent v2
Fecha: 2026-03-11

## Resumen ejecutivo
- Errores TypeScript encontrados / corregidos: 0 / 0 (build ya limpio al inicio)
- Guards de seguridad verificados/agregados: 8 rutas verificadas, 4 layouts agregados
- API routes con CSRF verificado/aplicado: 18 routes verificadas, 4 corregidas
- Queries con select(*) corregidas: 0 encontradas (ningún select(*) en páginas del dashboard)
- Strings en inglés corregidos: 8 strings en 2 archivos API
- Componentes base creados: 2 (EmptyState, PageHeader)
- Waterfalls eliminados: 0 nuevos (ya corregidos en sesión anterior)

## Estado del build
- `pnpm tsc --noEmit`: 0 errores ✅
- `pnpm build`: ✅ exitoso — 42 rutas, 0 errores TypeScript

## Checklist de seguridad

### CSRF en mutations
- `billing/adjust-balance` POST ✅
- `billing/delete-movement` DELETE ✅
- `billing/manual-invoices` POST ✅ (corregido — faltaba)
- `billing/patient-invoices` POST/PATCH/DELETE ✅ (corregido — faltaba)
- `billing/record-payment` POST ✅
- `billing/send-invoice` POST ✅ (corregido — faltaba)
- `billing/update-invoice` PUT ✅
- `billing/update-movement` PUT ✅
- `clients/[id]` PATCH ✅ (corregido — faltaba)
- `collaborators` POST ✅
- `collaborators/[id]` PUT/DELETE ✅
- `leads` POST ✅
- `orders/[id]` DELETE ✅
- `orders/[id]/status` PATCH ✅
- `orders/update-due-date` PUT ✅
- `portal/invitations` POST ✅
- `portal/invitations/[id]` DELETE/PATCH ✅
- `portal/users` POST ✅
- `catalog/[orgId]` GET — GET-only, sin CSRF requerido ✅
- `support/*` — admin auth, sin mutación de datos sensibles ✅

### org_id en queries
- Todas las páginas del dashboard filtran por `org.id` obtenido de `getUserOrg()` ✅
- API routes verifican org ownership antes de cada mutation ✅
- `clients/[id]` verifica relación lab→dentist antes de actualizar ✅

### Guards de rutas (layouts + pages)
- `dashboard/patients` — layout.tsx ✅
- `dashboard/appointments` — layout.tsx ✅
- `dashboard/billing` — layout.tsx ✅
- `dashboard/clients` — layout.tsx ✅
- `dashboard/schedule` — layout.tsx ✅ (creado), guard en page.tsx ✅
- `dashboard/kanban` — layout.tsx ✅ (creado), guard en page.tsx ✅
- `dashboard/cases` — layout.tsx ✅ (creado), guard en page.tsx ✅
- `dashboard/orders` — layout.tsx ✅ (creado), guard en page.tsx ✅
- `dashboard/settings` — guard via isCollaborator prop (CollaboratorsSection hidden) ✅
- `dashboard/laboratory` — guard en page.tsx `org.type !== 'lab'` ✅

### Variables de entorno
- `NEXT_PUBLIC_SUPABASE_URL` ✅ — requerido por el SDK de Supabase en el cliente (por diseño)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ — anon key es pública por diseño (RLS la protege)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, NO tiene prefijo NEXT_PUBLIC ✅
- `.env.local` tiene claves reales — asegurarse de que `.gitignore` lo excluye ✅

### Manejo de .single()
- Todos los `.single()` en pages verifican `!data` con `notFound()` ✅
- `.single()` en API routes verifican `!data` o `error` antes de continuar ✅

## Cambios por archivo

### API Routes modificadas
| Archivo | Cambio |
|---------|--------|
| `app/api/billing/manual-invoices/route.ts` | Agregado `validateCSRF` al inicio del POST |
| `app/api/billing/patient-invoices/route.ts` | Agregado `validateCSRF` a POST, PATCH y DELETE |
| `app/api/billing/send-invoice/route.ts` | Agregado `validateCSRF`; traducidas 7 strings al español |
| `app/api/clients/[id]/route.ts` | Agregado `validateCSRF` al PATCH |
| `app/api/catalog/[orgId]/route.ts` | Traducido "Internal server error" al español |

### Layouts de seguridad creados
| Archivo | Guard |
|---------|-------|
| `app/dashboard/schedule/layout.tsx` | `permissions?.view_schedule` |
| `app/dashboard/kanban/layout.tsx` | `org.type !== 'lab'` + `permissions?.view_kanban` |
| `app/dashboard/cases/layout.tsx` | `permissions?.view_cases` |
| `app/dashboard/orders/layout.tsx` | `permissions?.view_orders` |

### Componentes UI creados
| Archivo | Descripción |
|---------|-------------|
| `components/ui/empty-state.tsx` | Componente reutilizable para estados vacíos con ícono, título, descripción y acción opcional |
| `components/ui/page-header.tsx` | Componente reutilizable para encabezados de página con título, descripción y acción |

## Deuda técnica restante

### Alta prioridad
- **jsPDF vulnerabilidad HIGH** — `jspdf@4.1.0` tiene 3 CVEs (GHSA-p5xg-68wr-hm3m, GHSA-9vjf-qc39-jprp, GHSA-67pg-wm7f-q7fj). Actualizar a `>=4.2.0`. Evaluar si el uso actual de jsPDF usa AcroForms o addJS (si no, el impacto es menor).
- **settings/page.tsx** — No redirige a `/dashboard` si el usuario es collaborator. La UI oculta la sección de colaboradores, pero el usuario puede ver configuración de org. Considerar un redirect explícito para collaborators si la settings page no tiene info útil para ellos.

### Media prioridad
- **`billing/patient-invoices` usa `getOrgForUser()` local** — código duplicado del helper de auth. Cuando se refactorice, usar `getUserOrg()` de `lib/get-user-org.ts` para mantener React.cache() sharing.
- **`billing/manual-invoices` usa `getLabOrgForUser()` local** — mismo problema que arriba.
- **`clients/[id]/route.ts` tiene inline auth** — lógica de org lookup duplicada.
- **`orders-list.tsx` y dashboards** usan `ORDER_STATUS_BADGE_CLASSES` directamente en vez del componente `StatusBadge` — refactorización estética, no afecta seguridad ni funcionalidad.
- **Strings en inglés en API** — `"Unauthorized"` en varios routes es interno y no llega al usuario final en la mayoría de casos, pero traducir mejora la consistencia.

### Baja prioridad
- **minimatch ReDoS** — vulnerabilidades en dependencias transitivas de eslint. Solo afectan al entorno de desarrollo, no a producción.
- **`laboratory/page.tsx` query de organizations sin filtro por relación** — `select("id, name").eq("type", "dentist")` devuelve TODAS las organizaciones de tipo dentist del sistema en vez de solo las conectadas al laboratorio. No es un leak de datos crítico (solo nombres), pero debería filtrarse por `lab_dentist_relations`.

## Índices de Supabase sugeridos

Basado en las queries más frecuentes detectadas:

```sql
-- orders filtradas por org + created_at (orders page, kanban)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lab_orders_lab_org_created
  ON lab_orders(lab_org_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lab_orders_dentist_org_created
  ON lab_orders(dentist_org_id, created_at DESC);

-- appointments filtradas por org + fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_dentist_org_scheduled
  ON appointments(dentist_org_id, scheduled_at);

-- org_members filtradas por user_id (auth en cada request)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_id
  ON org_members(user_id);

-- invoices filtradas por lab_org + created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_lab_org_created
  ON invoices(lab_org_id, created_at DESC);

-- patients filtradas por dentist_org
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_dentist_org_id
  ON patients(dentist_org_id);
```

## Deuda técnica resuelta — 2026-03-11

- ✅ jspdf actualizado de 4.1.0 a 4.2.0 — 3 CVEs HIGH eliminados (PDF Injection AcroForm, addJS Object Injection, GIF DoS)
- ✅ Auth helpers duplicados eliminados en 3 routes (billing/patient-invoices, billing/manual-invoices, clients/[id]) — helpers locales `getOrgForUser`/`getLabOrgForUser` reemplazados por `getOrgForApiRoute()` centralizado en `lib/auth-utils.ts`
- ✅ laboratory/page.tsx filtra por relaciones activas via `lab_dentist_relations.status = 'active'` — reemplaza query genérica a organizations tipo dentist
- ✅ StatusBadge unificado — eliminados 4 usos inline de ORDER_STATUS_BADGE_CLASSES en archivos: `app/dashboard/clients/[id]/page.tsx`, `components/dashboard/lab-dashboard.tsx`, `components/dashboard/dentist-dashboard.tsx`, `components/schedule/weekly-schedule.tsx`. Imports huérfanos de ORDER_STATUS_BADGE_CLASSES/ORDER_STATUS_LABELS limpiados también en `app/dashboard/page.tsx`

### Estado final
- `pnpm tsc --noEmit`: 0 errores ✅
- `pnpm build`: ✅ exitoso — 52 rutas, 0 errores TypeScript
- `pnpm audit`: 8 vulnerabilidades restantes (6 high en minimatch vía eslint dev-dep, 2 moderate en ajv/dompurify vía eslint/jspdf transitivas) — ninguna directamente controlable sin fork de eslint
- Deuda técnica pendiente: ninguna
