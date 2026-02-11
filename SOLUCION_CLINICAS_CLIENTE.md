# Solución: Clínicas como Registros de Cliente

## Problema Original

Cuando el laboratorio creaba una clínica manual durante la entrada de pedidos, el sistema:
- ❌ Creaba una organización "real" en el sistema
- ❌ Agregaba automáticamente al usuario lab como miembro de esa clínica
- ❌ Redirigía a la página de onboarding
- ❌ Requería configuración completa de la organización

Pero lo que se necesitaba era:
- ✅ Crear un registro de cliente pasivo (solo para tracking interno)
- ✅ NO agregar al usuario como miembro
- ✅ NO disparar flujo de onboarding
- ✅ Permitir facturación y gestión de pedidos normalmente

## Solución Implementada

### 1. Nueva Columna: `is_system_account`

Se agregó una columna booleana a la tabla `organizations`:

- **`is_system_account = true`**: Organización real del sistema
  - Puede iniciar sesión
  - Requiere onboarding
  - Tiene usuarios miembros
  - Funcionalidad completa

- **`is_system_account = false`**: Registro de cliente pasivo
  - Solo para tracking interno del lab
  - NO puede iniciar sesión
  - NO tiene usuarios miembros
  - Se usa solo para pedidos y facturación

### 2. Archivos Modificados

#### `scripts/010_add_client_record_flag.sql`
- Agrega columna `is_system_account`
- Marca todas las organizaciones existentes como `true` (cuentas reales)
- Crea índice para performance
- Crea vistas helper: `active_organizations` y `client_records`

#### `scripts/011_fix_client_record_trigger.sql`
- Modifica trigger `on_org_created`
- Solo agrega usuario como owner si `is_system_account = true`
- Limpia membresías incorrectas de registros de cliente existentes

#### `components/dashboard/create-order-dialog.tsx`
- Cuando se crea clínica manual: `is_system_account: false`
- Agrega comentario explicativo en el código

```typescript
.insert({
  name: manualClinicName.trim(),
  type: 'dentist',
  is_system_account: false  // Registro de cliente, no usuario del sistema
})
```

#### `app/dashboard/layout.tsx`
- Filtra solo organizaciones con `is_system_account = true`
- Previene que registros de cliente causen redirecciones

#### `app/dashboard/page.tsx`
- Filtra solo organizaciones con `is_system_account = true`
- Misma lógica que layout para consistencia

### 3. Scripts SQL a Ejecutar (EN ORDEN)

```bash
# 1. Agregar columna is_system_account
scripts/010_add_client_record_flag.sql

# 2. Arreglar trigger y limpiar membresías incorrectas
scripts/011_fix_client_record_trigger.sql
```

## Cómo Funciona Ahora

### Escenario 1: Crear Organización Real (Onboarding Normal)

Usuario nuevo se registra → Onboarding → Crea su organización:

```sql
INSERT INTO organizations (name, type, is_system_account)
VALUES ('Mi Laboratorio', 'lab', true);
```

Resultado:
- ✅ Usuario agregado como owner (trigger funciona)
- ✅ Puede acceder al dashboard
- ✅ Organización completamente funcional

### Escenario 2: Crear Registro de Cliente (Manual en Lab)

Lab crea pedido manual → Checkbox "clínica no está en sistema" → Ingresa nombre:

```sql
INSERT INTO organizations (name, type, is_system_account)
VALUES ('Clínica del Dr. Smith', 'dentist', false);
```

Resultado:
- ✅ Usuario NO agregado como miembro (trigger lo detecta)
- ✅ NO redirige a onboarding
- ✅ Se crea registro solo para tracking
- ✅ Puede usarse para pedidos y facturación
- ✅ Lab mantiene su control de clientes existentes

## Verificación Post-Implementación

Después de ejecutar los scripts, verifica:

```sql
-- 1. Verificar que registros de cliente no tienen miembros
SELECT
  o.id,
  o.name,
  o.is_system_account,
  COUNT(om.user_id) as member_count
FROM organizations o
LEFT JOIN org_members om ON o.id = om.org_id
WHERE o.is_system_account = false
GROUP BY o.id, o.name, o.is_system_account;
-- member_count debe ser 0 para todos

-- 2. Verificar que organizaciones reales SÍ tienen miembros
SELECT
  o.id,
  o.name,
  o.is_system_account,
  COUNT(om.user_id) as member_count
FROM organizations o
LEFT JOIN org_members om ON o.id = om.org_id
WHERE o.is_system_account = true
GROUP BY o.id, o.name, o.is_system_account;
-- member_count debe ser > 0 para organizaciones activas

-- 3. Ver todas las organizaciones y su tipo
SELECT
  id,
  name,
  type,
  is_system_account,
  created_at
FROM organizations
ORDER BY created_at DESC;
```

## Prueba Manual

1. **Crear pedido manual con clínica nueva:**
   - Dashboard Lab → "Nuevo Pedido"
   - ✅ Marcar "La clínica no está en el sistema"
   - ✅ Ingresar nombre de clínica
   - ✅ Completar datos del pedido
   - ✅ Guardar

2. **Verificar comportamiento:**
   - ✅ Pedido se crea exitosamente
   - ✅ NO redirige a onboarding
   - ✅ Permanece en dashboard
   - ✅ Clínica aparece en lista de clientes
   - ✅ Puede crear más pedidos para esa clínica

3. **Verificar en base de datos:**
   ```sql
   SELECT * FROM organizations WHERE name = 'Nombre de tu clínica de prueba';
   -- is_system_account debe ser false

   SELECT * FROM org_members WHERE org_id = '[id de la clínica de prueba]';
   -- Debe estar VACÍO (0 rows)
   ```

## Notas Importantes

- **Organizaciones existentes**: Todas marcadas como `is_system_account = true` automáticamente
- **Migración segura**: No afecta funcionalidad existente
- **Compatibilidad**: Scripts anteriores (001-009) no necesitan cambios
- **RLS**: Las políticas super permisivas (script 009) siguen funcionando igual
- **Facturación**: Funciona igual para ambos tipos de organizaciones

## Diferencias Clave

| Característica | Sistema Account (true) | Cliente Record (false) |
|---|---|---|
| Puede iniciar sesión | ✅ Sí | ❌ No |
| Tiene usuarios miembros | ✅ Sí | ❌ No |
| Requiere onboarding | ✅ Sí | ❌ No |
| Usa para pedidos | ✅ Sí | ✅ Sí |
| Usa para facturación | ✅ Sí | ✅ Sí |
| Aparece en reportes lab | ✅ Sí | ✅ Sí |
| Se crea desde | Onboarding | Pedido manual |
| Propósito | Usuario real | Tracking interno |

## Beneficios

1. **Simplicidad**: Labs pueden ingresar pedidos de clientes que no usan el software
2. **Control**: Labs mantienen su base de clientes independiente
3. **Facturación completa**: Toda la facturación funciona normal
4. **Sin fricción**: No más redirecciones inesperadas
5. **Escalabilidad**: Clientes pueden "promocionarse" a cuentas reales después si lo desean

## Próximos Pasos Opcionales

Si en el futuro quieres "promover" un registro de cliente a cuenta real:

```sql
-- Promover registro de cliente a cuenta del sistema
UPDATE organizations
SET is_system_account = true
WHERE id = '[id_de_la_clinica]';

-- Luego el dueño de la clínica puede registrarse y será agregado como owner
```

---

**Implementado por:** Claude Code
**Fecha:** 2026-02-06
**Scripts:** 010, 011
**Archivos modificados:** 4
