# 📚 Guía Completa del Proyecto - DentLab Pro

## 🗂️ Estructura General

```
digitaldent v2/
├── 📁 app/              # Páginas y rutas (App Router de Next.js)
├── 📁 components/       # Componentes reutilizables
├── 📁 lib/             # Utilidades y configuraciones
├── 📁 scripts/         # Scripts SQL para la base de datos
└── 📁 public/          # Archivos estáticos
```

---

## 🌐 PÁGINAS PÚBLICAS (No requieren login)

### 1. **Landing Page**
📍 `app/page.tsx`
- **Qué es:** Página de inicio del sitio web
- **Componentes usados:**
  - `components/landing/header.tsx` - Navegación superior
  - `components/landing/hero.tsx` - Sección principal con CTA
  - `components/landing/stats.tsx` - Estadísticas de la plataforma
  - `components/landing/features.tsx` - Características del producto
  - `components/landing/how-it-works.tsx` - Cómo funciona
  - `components/landing/pricing.tsx` - Planes y precios
  - `components/landing/footer.tsx` - Pie de página
- **Editar para:**
  - Cambiar textos de marketing
  - Modificar precios
  - Actualizar características
  - Cambiar CTAs (Call to Actions)

---

## 🔐 PÁGINAS DE AUTENTICACIÓN

### 2. **Login**
📍 `app/auth/login/page.tsx`
- **Qué es:** Página de inicio de sesión
- **Editar para:**
  - Cambiar diseño del formulario
  - Modificar validaciones
  - Personalizar mensajes de error

### 3. **Sign Up (Registro)**
📍 `app/auth/sign-up/page.tsx`
- **Qué es:** Página de registro de nuevos usuarios
- **Editar para:**
  - Agregar/quitar campos del formulario
  - Cambiar lógica de registro
  - Modificar validaciones

### 4. **Sign Up Success**
📍 `app/auth/sign-up-success/page.tsx`
- **Qué es:** Confirmación después del registro
- **Editar para:**
  - Cambiar mensaje de bienvenida
  - Agregar instrucciones post-registro

### 5. **Auth Error**
📍 `app/auth/error/page.tsx`
- **Qué es:** Página de errores de autenticación
- **Editar para:**
  - Personalizar mensajes de error

### 6. **Auth Callback**
📍 `app/auth/callback/route.ts`
- **Qué es:** Maneja la respuesta de Supabase Auth
- **⚠️ NO MODIFICAR** a menos que sepas lo que haces

---

## 🎯 ONBOARDING

### 7. **Onboarding**
📍 `app/onboarding/page.tsx`
- **Qué es:** Configuración inicial después del registro
- **Funcionalidad:**
  - Crear organización (clínica dental o laboratorio)
  - Configurar datos básicos
- **Editar para:**
  - Agregar más pasos de onboarding
  - Cambiar campos de configuración
  - Personalizar el flujo de bienvenida

---

## 🏠 DASHBOARD - Layout Principal

### 8. **Dashboard Layout**
📍 `app/dashboard/layout.tsx`
- **Qué es:** Layout que envuelve todas las páginas del dashboard
- **Funcionalidad:**
  - Verifica autenticación
  - Carga organización del usuario
  - Muestra sidebar
- **Componentes:**
  - `components/dashboard/sidebar.tsx` - Navegación lateral
- **Editar para:**
  - Cambiar estructura general del dashboard
  - Modificar verificaciones de acceso

---

## 📊 DASHBOARD - Páginas para DENTISTAS

### 9. **Dashboard Principal**
📍 `app/dashboard/page.tsx`
- **Qué es:** Vista principal del dashboard (para dentistas y laboratorios)
- **Muestra:**
  - Estadísticas generales (pacientes, pedidos, facturación)
  - Pedidos recientes
  - Resumen mensual
- **Componentes:**
  - `components/dashboard/dashboard-header.tsx` - Encabezado
  - `components/dashboard/quick-actions.tsx` - Acciones rápidas (solo dentistas)
- **Editar para:**
  - Cambiar KPIs mostrados
  - Modificar widgets del dashboard
  - Personalizar gráficos

### 10. **Pacientes** (Solo Dentistas)
📍 `app/dashboard/patients/page.tsx`
- **Qué es:** Lista de todos los pacientes de la clínica
- **Componentes:**
  - `components/patients/patients-list.tsx` - Tabla de pacientes
  - `components/dashboard/create-patient-dialog.tsx` - Diálogo para crear paciente
  - `components/patients/edit-patient-dialog.tsx` - Diálogo para editar
  - `components/patients/patient-actions.tsx` - Acciones (editar, eliminar)
- **Editar para:**
  - Agregar campos a pacientes
  - Modificar tabla/filtros
  - Cambiar acciones disponibles

### 11. **Detalle de Paciente** (Solo Dentistas)
📍 `app/dashboard/patients/[id]/page.tsx`
- **Qué es:** Vista detallada de un paciente específico
- **Muestra:**
  - Información del paciente
  - Historial de pedidos
  - Citas
- **Editar para:**
  - Agregar más información del paciente
  - Mostrar historial médico
  - Agregar notas

### 12. **Citas** (Solo Dentistas)
📍 `app/dashboard/appointments/page.tsx`
- **Qué es:** Gestión de citas de la clínica
- **Componentes:**
  - `components/appointments/appointments-list.tsx` - Lista de citas
  - `components/dashboard/create-appointment-dialog.tsx` - Crear cita
- **Editar para:**
  - Cambiar calendario/vista
  - Agregar recordatorios
  - Modificar tipos de citas

### 13. **Pedidos** (Dentistas y Laboratorios)
📍 `app/dashboard/orders/page.tsx`
- **Qué es:** Lista de pedidos enviados/recibidos
- **Para dentistas:** Pedidos enviados a laboratorios
- **Para laboratorios:** Pedidos recibidos de clínicas
- **Componentes:**
  - `components/orders/orders-list.tsx` - Tabla de pedidos
  - `components/dashboard/create-order-dialog.tsx` - Crear pedido (dentistas)
- **Editar para:**
  - Cambiar columnas de la tabla
  - Modificar filtros
  - Agregar acciones masivas

### 14. **Detalle de Pedido**
📍 `app/dashboard/orders/[id]/page.tsx`
- **Qué es:** Vista detallada de un pedido específico
- **Muestra:**
  - Información del pedido
  - Items del trabajo
  - Estado y timeline
- **Editar para:**
  - Agregar más detalles
  - Modificar estados disponibles
  - Agregar seguimiento

---

## 🔬 DASHBOARD - Páginas para LABORATORIOS

### 15. **Producción (Kanban)** (Solo Laboratorios)
📍 `app/dashboard/kanban/page.tsx`
- **Qué es:** Vista tipo Kanban para gestión de producción
- **Componentes:**
  - `components/kanban/kanban-board.tsx` - Tablero Kanban
- **Editar para:**
  - Cambiar columnas del tablero
  - Modificar estados de producción
  - Agregar automatizaciones

### 16. **Clínicas** (Solo Laboratorios)
📍 `app/dashboard/clients/page.tsx`
- **Qué es:** Lista de clínicas dentales que son clientes
- **Editar para:**
  - Agregar información de clínicas
  - Mostrar estadísticas por cliente
  - Gestionar relaciones

### 17. **Dashboard de Laboratorio**
📍 `app/dashboard/laboratory/page.tsx`
- **Qué es:** Vista especial del dashboard para laboratorios
- **Componentes:**
  - `app/dashboard/laboratory/components/TotalOrdersCard.tsx`
  - `app/dashboard/laboratory/components/WorksInProgressList.tsx`
  - `app/dashboard/laboratory/components/SummaryReportCard.tsx`
  - `app/dashboard/laboratory/components/ActiveClientCard.tsx`
- **Editar para:**
  - Cambiar métricas de producción
  - Modificar reportes
  - Agregar análisis

---

## 💰 FACTURACIÓN (Compartido)

### 18. **Facturación**
📍 `app/dashboard/billing/page.tsx`
- **Qué es:** Gestión de facturación y pagos
- **Componentes:**
  - `components/billing/billing-dashboard.tsx`
- **Editar para:**
  - Agregar métodos de pago
  - Modificar reportes financieros
  - Gestionar facturas

---

## ⚙️ CONFIGURACIÓN

### 19. **Configuración**
📍 `app/dashboard/settings/page.tsx`
- **Qué es:** Configuración de la organización y perfil
- **Componentes:**
  - `components/settings/settings-form.tsx`
- **Editar para:**
  - Agregar opciones de configuración
  - Modificar preferencias
  - Gestionar integraciones

---

## 🧩 COMPONENTES PRINCIPALES

### 📁 components/dashboard/

| Componente | Qué hace | Dónde se usa |
|------------|----------|--------------|
| `sidebar.tsx` | Navegación lateral del dashboard | Todas las páginas del dashboard |
| `dashboard-header.tsx` | Encabezado con usuario y título | Todas las páginas del dashboard |
| `quick-actions.tsx` | Botones de acciones rápidas | Dashboard principal (dentistas) |
| `create-order-dialog.tsx` | Modal para crear pedidos | Pedidos, Dashboard |
| `create-patient-dialog.tsx` | Modal para crear pacientes | Pacientes, Quick Actions |
| `create-appointment-dialog.tsx` | Modal para crear citas | Citas, Quick Actions |

### 📁 components/ui/

Componentes de interfaz reutilizables (basados en shadcn/ui):
- `button.tsx` - Botones
- `card.tsx` - Tarjetas
- `dialog.tsx` - Modales
- `input.tsx` - Campos de texto
- `select.tsx` - Selectores
- `table.tsx` - Tablas
- `badge.tsx` - Etiquetas de estado
- `dropdown-menu.tsx` - Menús desplegables
- `user-dropdown.tsx` - Menú del usuario (logout, perfil)

**⚠️ IMPORTANTE:** Estos componentes son la base del diseño. Modificarlos afectará a todo el proyecto.

### 📁 components/landing/

Componentes específicos de la landing page:
- `header.tsx` - Navegación superior
- `hero.tsx` - Sección principal
- `features.tsx` - Características
- `pricing.tsx` - Precios
- `footer.tsx` - Pie de página

---

## 🛠️ UTILIDADES Y CONFIGURACIÓN

### 📁 lib/

| Archivo | Propósito |
|---------|-----------|
| `lib/utils.ts` | Utilidades generales (cn, formatters) |
| `lib/order-status.ts` | Estados de pedidos, colores, labels |
| `lib/supabase/client.ts` | Cliente de Supabase (lado cliente) |
| `lib/supabase/server.ts` | Cliente de Supabase (lado servidor) |
| `lib/supabase/proxy.ts` | Proxy para requests |

---

## 🗃️ BASE DE DATOS

### 📁 scripts/

Scripts SQL para configurar la base de datos:
- `001_initial_schema.sql` - Schema inicial
- `002_fix_permissions.sql` - Permisos y triggers
- `003_patients.sql` - Tabla de pacientes
- `004_laboratory_dashboard.sql` - Vistas para laboratorio

**Referencia completa:** `DATABASE_REFERENCE.md`

---

## 📋 GUÍA RÁPIDA: ¿DÓNDE EDITAR?

### Quiero cambiar...

#### 🎨 **Diseño y Estilos**
- **Colores globales:** `app/globals.css` (variables CSS)
- **Componentes UI:** `components/ui/`
- **Sidebar:** `components/dashboard/sidebar.tsx`

#### 📝 **Textos y Contenido**
- **Landing page:** `components/landing/`
- **Mensajes de error:** Archivos `page.tsx` individuales
- **Labels de estados:** `lib/order-status.ts`

#### 🔄 **Funcionalidad**
- **Crear pedido:** `components/dashboard/create-order-dialog.tsx`
- **Crear paciente:** `components/dashboard/create-patient-dialog.tsx`
- **Lista de pedidos:** `components/orders/orders-list.tsx`
- **Lista de pacientes:** `components/patients/patients-list.tsx`

#### 📊 **Dashboard**
- **KPIs y estadísticas:** `app/dashboard/page.tsx`
- **Widgets:** Componentes en `components/dashboard/`

#### 🗄️ **Base de Datos**
- **Schema:** `scripts/*.sql`
- **Queries:** Archivos `page.tsx` de cada sección
- **Cliente Supabase:** `lib/supabase/`

#### 🔐 **Autenticación**
- **Login:** `app/auth/login/page.tsx`
- **Registro:** `app/auth/sign-up/page.tsx`
- **Onboarding:** `app/onboarding/page.tsx`

#### 💰 **Precios**
- **Planes:** `components/landing/pricing.tsx`
- **Facturación:** `components/billing/billing-dashboard.tsx`

---

## 🎯 FLUJOS PRINCIPALES

### Flujo de Dentista:
1. **Registro** → `auth/sign-up`
2. **Onboarding** → `onboarding` (crear organización tipo "dentist")
3. **Dashboard** → `dashboard`
4. **Crear Paciente** → `dashboard/patients`
5. **Crear Pedido** → `dashboard/orders` (enviar a laboratorio)
6. **Ver Estado** → `dashboard/orders/[id]`

### Flujo de Laboratorio:
1. **Registro** → `auth/sign-up`
2. **Onboarding** → `onboarding` (crear organización tipo "lab")
3. **Dashboard** → `dashboard/laboratory`
4. **Recibir Pedidos** → `dashboard/orders`
5. **Gestionar Producción** → `dashboard/kanban`
6. **Ver Clínicas** → `dashboard/clients`

---

## 🔑 CONVENCIONES

### Tipos de Organización:
- `dentist` - Clínica Dental
- `lab` - Laboratorio Dental

### Estados de Pedidos (ver `lib/order-status.ts`):
- `draft` - Borrador
- `received` - Recibido
- `in_production` - En Producción
- `quality_check` - Control de Calidad
- `ready` - Listo para Entrega
- `delivered` - Entregado
- `cancelled` - Cancelado

### Estructura de Archivos:
- `page.tsx` - Página (ruta accesible)
- `layout.tsx` - Layout que envuelve páginas hijas
- `route.ts` - API route
- Carpetas con `[]` - Rutas dinámicas (ej: `[id]`)

---

## 📱 RESPONSIVE

El proyecto usa Tailwind CSS con breakpoints:
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## 🚀 COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start

# Linting
npm run lint
```

---

## 📞 PRÓXIMOS PASOS RECOMENDADOS

1. ✅ Familiarízate con la estructura
2. ✅ Revisa `DATABASE_REFERENCE.md` para entender las tablas
3. ✅ Prueba crear un pedido de prueba
4. ✅ Personaliza los textos de la landing
5. ✅ Ajusta los colores en `globals.css`

---

**Última actualización:** 2026-02-05
**Versión:** 2.0 - Post Optimización
