# ⚡ Referencia Rápida - "¿Dónde está...?"

## 🔍 Búsqueda Rápida por Tarea

### "Quiero cambiar el texto de..."

| Lo que quieres cambiar | Archivo |
|------------------------|---------|
| Título de la landing | `components/landing/hero.tsx` línea 20-22 |
| Slogan/descripción principal | `components/landing/hero.tsx` línea 24-26 |
| Botón "Comenzar Gratis" | `components/landing/hero.tsx` línea 30-35 |
| Características del producto | `components/landing/features.tsx` |
| Precios y planes | `components/landing/pricing.tsx` |
| Título del sitio (SEO) | `app/layout.tsx` línea 8-11 |
| Nombre en sidebar | `components/dashboard/sidebar.tsx` línea 86-90 |
| Estados de pedidos (labels) | `lib/order-status.ts` líneas 22-32 |

### "Quiero modificar el diseño de..."

| Elemento | Archivo |
|----------|---------|
| Colores globales | `app/globals.css` líneas 5-50 |
| Sidebar | `components/dashboard/sidebar.tsx` |
| Header del dashboard | `components/dashboard/dashboard-header.tsx` |
| Botones | `components/ui/button.tsx` |
| Tarjetas (Cards) | `components/ui/card.tsx` |
| Modales (Dialogs) | `components/ui/dialog.tsx` |
| Tablas | `components/ui/table.tsx` |
| Landing page completa | `app/page.tsx` + `components/landing/*` |

### "Quiero agregar/modificar funcionalidad de..."

| Funcionalidad | Archivos Clave |
|---------------|----------------|
| Crear pedido | `components/dashboard/create-order-dialog.tsx` |
| Lista de pedidos | `components/orders/orders-list.tsx` |
| Detalle de pedido | `app/dashboard/orders/[id]/page.tsx` |
| Crear paciente | `components/dashboard/create-patient-dialog.tsx` |
| Lista de pacientes | `components/patients/patients-list.tsx` |
| Editar paciente | `components/patients/edit-patient-dialog.tsx` |
| Crear cita | `components/dashboard/create-appointment-dialog.tsx` |
| Lista de citas | `components/appointments/appointments-list.tsx` |
| Kanban (producción) | `components/kanban/kanban-board.tsx` |
| Dashboard principal | `app/dashboard/page.tsx` |
| Dashboard laboratorio | `app/dashboard/laboratory/page.tsx` |
| Login | `app/auth/login/page.tsx` |
| Registro | `app/auth/sign-up/page.tsx` |
| Onboarding | `app/onboarding/page.tsx` |

### "Quiero cambiar los campos de..."

| Formulario | Archivo | Campo a buscar |
|------------|---------|----------------|
| Formulario de pedido | `create-order-dialog.tsx` | `formData` (línea 66-74) |
| Formulario de paciente | `create-patient-dialog.tsx` | `formData` |
| Formulario de cita | `create-appointment-dialog.tsx` | `formData` |
| Formulario de onboarding | `app/onboarding/page.tsx` | `formData` (línea 15-20) |

---

## 📂 Archivos por Frecuencia de Edición

### 🔥 Muy Frecuente (Personalizaciones comunes)

```
app/globals.css ........................... Colores y estilos globales
components/landing/hero.tsx ............... Textos principales
components/landing/pricing.tsx ............ Planes y precios
components/dashboard/sidebar.tsx .......... Navegación
lib/order-status.ts ....................... Estados y labels
```

### 🔄 Frecuente (Funcionalidades)

```
components/dashboard/create-order-dialog.tsx
components/dashboard/create-patient-dialog.tsx
components/orders/orders-list.tsx
components/patients/patients-list.tsx
app/dashboard/page.tsx
```

### 📝 Ocasional (Configuración)

```
next.config.mjs ........................... Configuración Next.js
app/layout.tsx ............................ Layout root y metadata
lib/supabase/client.ts .................... Cliente Supabase
lib/utils.ts .............................. Utilidades
```

### ⚠️ Raramente (Infraestructura)

```
scripts/*.sql ............................. Base de datos
lib/supabase/server.ts .................... Server-side Supabase
tsconfig.json ............................. TypeScript config
```

---

## 🎯 Casos de Uso Comunes

### 1. "Quiero agregar un nuevo campo a los pedidos"

**Pasos:**
1. Modificar tabla en BD: `scripts/` → agregar columna a `lab_orders`
2. Ejecutar SQL en Supabase
3. Actualizar formulario: `components/dashboard/create-order-dialog.tsx`
   - Agregar campo a `formData` (línea 66)
   - Agregar Input en el JSX (línea 177+)
   - Agregar en INSERT (línea 100)
4. Actualizar lista: `components/orders/orders-list.tsx`
   - Agregar columna a la tabla

### 2. "Quiero cambiar los colores del sitio"

**Pasos:**
1. Abrir `app/globals.css`
2. Modificar variables CSS (líneas 6-32):
   ```css
   --primary: 0 0% 10%;      ← Color principal
   --accent: 175 50% 40%;    ← Color de acento
   ```
3. Guardar y ver cambios automáticamente

### 3. "Quiero agregar un nuevo estado de pedido"

**Pasos:**
1. Abrir `lib/order-status.ts`
2. Agregar a `ORDER_STATUS_ALL` (línea 2)
3. Agregar a `ORDER_STATUS_LABELS` (línea 22)
4. Agregar a `ORDER_STATUS_BADGE_CLASSES` (línea 34)
5. Actualizar en Kanban: `components/kanban/kanban-board.tsx`

### 4. "Quiero personalizar el Dashboard"

**Pasos:**
1. Abrir `app/dashboard/page.tsx`
2. Modificar stats (línea 91-103):
   ```typescript
   const stats = [
     { label: "Tu Métrica", value: 123, icon: TuIcono, ... }
   ]
   ```
3. Modificar queries de Supabase (líneas 50-65)
4. Agregar/quitar widgets en JSX (línea 153+)

### 5. "Quiero cambiar el sidebar (navegación)"

**Pasos:**
1. Abrir `components/dashboard/sidebar.tsx`
2. Modificar arrays de navegación:
   - `dentistNav` (línea 26-33)
   - `labNav` (línea 35-42)
3. Agregar/quitar items:
   ```typescript
   { href: "/dashboard/nueva-ruta", label: "Nueva Sección", icon: IconoNuevo }
   ```
4. Crear la nueva página: `app/dashboard/nueva-ruta/page.tsx`

### 6. "Quiero agregar un nuevo tipo de organización"

**⚠️ Avanzado - Requiere cambios extensos**

**Pasos:**
1. Modificar enum en BD: `scripts/` → actualizar tipo `organization_type`
2. Actualizar `lib/` → agregar nuevo tipo
3. Modificar `app/dashboard/layout.tsx` → lógica de permisos
4. Crear nueva navegación en `sidebar.tsx`
5. Crear páginas específicas para el nuevo tipo

### 7. "Quiero cambiar textos del landing"

**Archivo único:** `components/landing/hero.tsx`

```typescript
// Línea 20-22: Título principal
<h1 className="...">
  Tu Nuevo Título Aquí
</h1>

// Línea 24-26: Descripción
<p className="...">
  Tu nueva descripción aquí
</p>

// Línea 31-34: Botón principal
<Button>
  Tu nuevo CTA
</Button>
```

### 8. "Quiero modificar los campos de creación de paciente"

**Archivo:** `components/dashboard/create-patient-dialog.tsx`

```typescript
// 1. Agregar al estado (busca 'formData')
const [formData, setFormData] = useState({
  firstName: "",
  lastName: "",
  // ✅ Agregar nuevo campo
  tuNuevoCampo: "",
});

// 2. Agregar Input en el formulario (busca '<Input')
<div className="space-y-2">
  <Label htmlFor="tuNuevoCampo">Tu Label</Label>
  <Input
    id="tuNuevoCampo"
    value={formData.tuNuevoCampo}
    onChange={(e) => setFormData({
      ...formData,
      tuNuevoCampo: e.target.value
    })}
  />
</div>

// 3. Agregar al INSERT de Supabase (busca '.insert')
.insert({
  first_name: formData.firstName,
  // ✅ Agregar aquí
  tu_nuevo_campo: formData.tuNuevoCampo,
})
```

---

## 🔧 Utilidades y Helpers

### Funciones Útiles

| Función | Ubicación | Uso |
|---------|-----------|-----|
| `cn()` | `lib/utils.ts` | Combinar clases CSS de Tailwind |
| `createClient()` | `lib/supabase/client.ts` | Cliente Supabase (client-side) |
| `createClient()` | `lib/supabase/server.ts` | Cliente Supabase (server-side) |
| Estados de pedidos | `lib/order-status.ts` | Constantes y helpers de estados |

### Ejemplo de uso de `cn()`:

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  someCondition ? "conditional-class" : "default-class"
)}>
```

---

## 📋 Cheatsheet de Queries Supabase

### Obtener datos del usuario actual

```typescript
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Obtener organización del usuario

```typescript
const { data: membership } = await supabase
  .from("org_members")
  .select("organization:org_id(id, name, type)")
  .eq("user_id", user.id)
  .single();
```

### Obtener pedidos (dentista)

```typescript
const { data: orders } = await supabase
  .from("lab_orders")
  .select(`
    *,
    patient:patients(first_name, last_name),
    lab_org:organizations!lab_orders_lab_org_id_fkey(name)
  `)
  .eq("dentist_org_id", org.id)
  .order("created_at", { ascending: false });
```

### Crear pedido

```typescript
const { data: order, error } = await supabase
  .from("lab_orders")
  .insert({
    dentist_org_id: orgId,
    lab_org_id: labId,
    patient_id: patientId,
    status: "received",
  })
  .select()
  .single();
```

### Actualizar estado de pedido

```typescript
const { error } = await supabase
  .from("lab_orders")
  .update({ status: "in_production" })
  .eq("id", orderId);
```

---

## 🎨 Componentes UI - Props Comunes

### Button

```typescript
<Button
  variant="default" | "outline" | "ghost" | "destructive"
  size="default" | "sm" | "lg"
  disabled={boolean}
  onClick={handler}
>
  Texto
</Button>
```

### Dialog

```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
      <DialogDescription>Descripción</DialogDescription>
    </DialogHeader>
    {/* Contenido */}
  </DialogContent>
</Dialog>
```

### Select

```typescript
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Selecciona..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Opción 1</SelectItem>
    <SelectItem value="option2">Opción 2</SelectItem>
  </SelectContent>
</Select>
```

### Card

```typescript
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenido */}
  </CardContent>
</Card>
```

---

## 🐛 Troubleshooting Común

### "No se muestran los datos"

**Revisar:**
1. Query de Supabase: `app/[ruta]/page.tsx`
2. Permisos en Supabase (RLS)
3. Console del navegador para errores

### "El formulario no se envía"

**Revisar:**
1. `handleSubmit` en el componente del dialog
2. Validación de campos requeridos
3. Errores en la consola

### "Error de tipo TypeScript"

**Solución:**
1. Agregar tipos a los datos de Supabase
2. Usar `as` para casting cuando sea necesario
3. Verificar interfaces definidas

### "Cambios no se ven reflejados"

**Solución:**
1. Verificar que guardaste el archivo
2. Limpiar caché: `rm -rf .next`
3. Reiniciar servidor: `npm run dev`

---

## 📞 Documentos Relacionados

- 📚 **Guía completa:** `GUIA_DEL_PROYECTO.md`
- 🏗️ **Arquitectura visual:** `ARQUITECTURA_VISUAL.md`
- 🗄️ **Base de datos:** `DATABASE_REFERENCE.md`
- ⚡ **Optimizaciones:** `OPTIMIZACIONES_REALIZADAS.md`

---

## 💡 Tips Finales

1. **Buscar en el proyecto:**
   ```bash
   # Buscar texto en archivos
   grep -r "texto a buscar" app/ components/

   # Buscar nombre de función/componente
   grep -r "NombreComponente" .
   ```

2. **Ver estructura rápidamente:**
   ```bash
   # Ver árbol de directorios
   find app -type f -name "*.tsx" | sort
   ```

3. **Antes de editar un componente compartido** (en `components/ui/`):
   - Busca dónde se usa: `grep -r "ComponentName" .`
   - Considera el impacto global

4. **Siempre lee el archivo completo** antes de hacer cambios grandes

5. **Usa la consola del navegador** (F12) para debugging

---

**Creado:** 2026-02-05
**Última actualización:** Post-Optimización v2.0
