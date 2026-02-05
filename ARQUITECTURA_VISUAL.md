# 🏗️ Arquitectura Visual - DentLab Pro

## 📐 Mapa del Sitio

```
DentLab Pro
│
├─── 🌐 PÚBLICO
│    ├── / (Landing Page)
│    │   ├── Header (Navegación)
│    │   ├── Hero (CTA principal)
│    │   ├── Stats (Estadísticas)
│    │   ├── Features (Características)
│    │   ├── How It Works (Cómo funciona)
│    │   ├── Pricing (Planes)
│    │   └── Footer
│    │
│    └── /auth
│        ├── /login .................. Iniciar sesión
│        ├── /sign-up ................ Registro
│        ├── /sign-up-success ........ Confirmación
│        └── /error .................. Errores auth
│
├─── 🎯 ONBOARDING (Autenticado, sin org)
│    └── /onboarding ................ Crear organización
│
└─── 🏠 DASHBOARD (Autenticado + organización)
     ├── /dashboard ................ Vista principal
     │
     ├─── 👨‍⚕️ DENTISTA
     │    ├── /patients ............ Lista pacientes
     │    │   └── /[id] ............ Detalle paciente
     │    ├── /appointments ........ Citas
     │    ├── /orders .............. Pedidos enviados
     │    │   └── /[id] ............ Detalle pedido
     │    ├── /billing ............. Facturación
     │    └── /settings ............ Configuración
     │
     └─── 🔬 LABORATORIO
          ├── /laboratory .......... Dashboard lab
          ├── /orders .............. Pedidos recibidos
          │   └── /[id] ............ Detalle pedido
          ├── /kanban .............. Producción
          ├── /clients ............. Clínicas
          ├── /billing ............. Facturación
          └── /settings ............ Configuración
```

---

## 🔄 Flujo de Usuario

### 1️⃣ Nuevo Usuario → Dentista

```
┌─────────────┐
│   LANDING   │ "Comenzar Gratis"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SIGN UP    │ Email + Password
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ONBOARDING  │ Tipo: "Clínica Dental"
└──────┬──────┘     Nombre: "Dr. Pérez Dental"
       │
       ▼
┌─────────────┐
│  DASHBOARD  │ Estadísticas + Quick Actions
└──────┬──────┘
       │
       ├──► CREAR PACIENTE ──► Lista de Pacientes
       │
       └──► CREAR PEDIDO ────► Enviar a Laboratorio
                                      │
                                      ▼
                                 Ver en /orders
```

### 2️⃣ Nuevo Usuario → Laboratorio

```
┌─────────────┐
│   LANDING   │ "Comenzar Gratis"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SIGN UP    │ Email + Password
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ONBOARDING  │ Tipo: "Laboratorio"
└──────┬──────┘     Nombre: "DentalLab Pro"
       │
       ▼
┌─────────────┐
│ LABORATORY  │ Pedidos + Producción
│  DASHBOARD  │
└──────┬──────┘
       │
       ├──► VER PEDIDOS ──► /orders (recibidos)
       │
       ├──► KANBAN ───────► /kanban (gestionar producción)
       │
       └──► CLIENTES ─────► /clients (clínicas)
```

---

## 🗂️ Estructura de Componentes

### Jerarquía Visual

```
app/layout.tsx (ROOT)
├── Toaster (Notificaciones)
└── {children}
    │
    ├─── LANDING (app/page.tsx)
    │    └── ReactLenis (Smooth Scroll)
    │         ├── Header
    │         ├── Hero
    │         ├── Stats
    │         ├── Features
    │         ├── HowItWorks
    │         ├── Pricing
    │         └── Footer
    │
    └─── DASHBOARD (app/dashboard/layout.tsx)
         ├── Sidebar (navegación)
         │    ├── Logo
         │    ├── Org Info
         │    ├── Nav Items
         │    └── Help Card
         │
         └── Main Content
              ├── DashboardHeader
              │    ├── Title
              │    └── UserDropdown
              │         ├── Profile
              │         └── Logout
              │
              └── Page Content
                   ├── Stats Cards
                   ├── Quick Actions (dentist)
                   └── Tables/Lists
```

---

## 🎨 Sistema de Diseño

### Componentes UI (components/ui/)

```
┌─────────────────────────────────────┐
│        COMPONENTES BASE UI          │
├─────────────────────────────────────┤
│                                     │
│  📦 Layout                          │
│  ├── Card ──────────── Contenedores│
│  ├── Separator ─────── Divisores   │
│  └── Dialog ────────── Modales     │
│                                     │
│  📝 Forms                           │
│  ├── Input ─────────── Texto       │
│  ├── Textarea ──────── Texto largo │
│  ├── Select ────────── Desplegable │
│  ├── Label ─────────── Etiquetas   │
│  └── Button ────────── Botones     │
│                                     │
│  📊 Data Display                    │
│  ├── Table ─────────── Tablas      │
│  ├── Badge ─────────── Estados     │
│  └── Avatar ────────── Usuario     │
│                                     │
│  🎯 Navigation                      │
│  ├── DropdownMenu ─── Menús        │
│  └── UserDropdown ─── Menú usuario │
│                                     │
└─────────────────────────────────────┘
```

### Flujo de Estado en Modales

```
Componente Padre (ej: orders/page.tsx)
       │
       ├─── Estado: patients, labs, orders
       │
       └─── Pasa props ▼
                │
         ┌──────┴──────┐
         │   DIALOG    │ (CreateOrderDialog)
         ├─────────────┤
         │  - open     │ ◄── Estado interno
         │  - formData │ ◄── Estado del formulario
         │  - loading  │ ◄── Estado de carga
         └──────┬──────┘
                │
                ├─── handleSubmit()
                │     ├── INSERT into lab_orders
                │     ├── INSERT into lab_order_items
                │     └── router.refresh()
                │
                └─── onOpenChange() ──► Cerrar modal
```

---

## 🔐 Flujo de Autenticación

```
┌──────────────────────────────────────────────────┐
│           SUPABASE AUTH FLOW                     │
└──────────────────────────────────────────────────┘

Usuario completa formulario
         │
         ▼
    supabase.auth.signUp()
         │
         ├─── ✅ Success
         │     ├── Usuario creado en auth.users
         │     ├── Trigger crea perfil
         │     └── Redirect → /onboarding
         │
         └─── ❌ Error
               └── Mostrar error en UI


┌──────────────────────────────────────────────────┐
│         ORGANIZATION CHECK                       │
└──────────────────────────────────────────────────┘

layout.tsx (dashboard)
         │
         ▼
    getUser() ────────────────┐
         │                    │
         ├─── ❌ No user      │
         │     └── redirect   │
         │         /auth/login│
         │                    │
         ✅ User exists       │
         │                    │
         ▼                    │
    Query org_members ◄──────┘
         │
         ├─── ❌ No org
         │     └── redirect
         │         /onboarding
         │
         ✅ Has org
         │
         ▼
    Render dashboard
    con sidebar (org type)
```

---

## 📊 Base de Datos - Relaciones

```
┌──────────────┐
│    users     │ (Supabase Auth)
│  (auth.users)│
└──────┬───────┘
       │
       ▼ user_id
┌──────────────────┐
│  organizations   │
│ ├── id           │
│ ├── name         │
│ ├── type ───────┼──► "dentist" | "lab"
│ └── ...          │
└────┬─────────────┘
     │
     ├─── org_members (junction)
     │     └── user_id, org_id, role
     │
     ├─── patients (si type = "dentist")
     │     ├── dentist_org_id ──┐
     │     └── ...               │
     │                           │
     └─── lab_orders             │
           ├── dentist_org_id ◄──┘
           ├── lab_org_id
           └── patient_id ───────┐
                                 │
           lab_order_items       │
           ├── order_id          │
           └── ...               │
                                 │
     ┌────────────────────────────┘
     ▼
patients
├── id
├── first_name
├── last_name
└── ...
```

---

## 🚀 Rutas y Permisos

| Ruta | Requiere Auth | Requiere Org | Tipo Org |
|------|--------------|--------------|----------|
| `/` | ❌ No | ❌ No | - |
| `/auth/*` | ❌ No | ❌ No | - |
| `/onboarding` | ✅ Sí | ❌ No | - |
| `/dashboard` | ✅ Sí | ✅ Sí | Ambos |
| `/dashboard/patients` | ✅ Sí | ✅ Sí | Dentista |
| `/dashboard/appointments` | ✅ Sí | ✅ Sí | Dentista |
| `/dashboard/laboratory` | ✅ Sí | ✅ Sí | Lab |
| `/dashboard/kanban` | ✅ Sí | ✅ Sí | Lab |
| `/dashboard/clients` | ✅ Sí | ✅ Sí | Lab |
| `/dashboard/orders` | ✅ Sí | ✅ Sí | Ambos |
| `/dashboard/billing` | ✅ Sí | ✅ Sí | Ambos |
| `/dashboard/settings` | ✅ Sí | ✅ Sí | Ambos |

---

## 🎯 Componentes por Funcionalidad

### 🦷 DENTISTA

```
┌─────────────────────────────────────────┐
│         FUNCIONALIDADES DENTISTA         │
├─────────────────────────────────────────┤
│                                         │
│  📋 Gestión de Pacientes                │
│  ├── patients-list.tsx                  │
│  ├── create-patient-dialog.tsx          │
│  ├── edit-patient-dialog.tsx            │
│  └── patient-actions.tsx                │
│                                         │
│  📅 Gestión de Citas                    │
│  ├── appointments-list.tsx              │
│  └── create-appointment-dialog.tsx      │
│                                         │
│  📦 Gestión de Pedidos                  │
│  ├── orders-list.tsx                    │
│  └── create-order-dialog.tsx            │
│                                         │
│  ⚡ Quick Actions                        │
│  └── quick-actions.tsx                  │
│      ├── Nuevo Paciente                 │
│      ├── Nueva Cita                     │
│      └── Nuevo Pedido                   │
│                                         │
└─────────────────────────────────────────┘
```

### 🔬 LABORATORIO

```
┌─────────────────────────────────────────┐
│        FUNCIONALIDADES LABORATORIO       │
├─────────────────────────────────────────┤
│                                         │
│  📊 Dashboard Lab                       │
│  ├── TotalOrdersCard.tsx                │
│  ├── WorksInProgressList.tsx            │
│  ├── SummaryReportCard.tsx              │
│  └── ActiveClientCard.tsx               │
│                                         │
│  📦 Gestión de Pedidos                  │
│  └── orders-list.tsx                    │
│      (Vista de pedidos recibidos)       │
│                                         │
│  🎯 Producción (Kanban)                 │
│  └── kanban-board.tsx                   │
│      ├── Recibido                       │
│      ├── En Producción                  │
│      ├── Control Calidad                │
│      ├── Listo                          │
│      └── Entregado                      │
│                                         │
│  🏢 Gestión de Clientes                 │
│  └── (Lista de clínicas)                │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔄 Ciclo de Vida de un Pedido

```
DENTISTA                    SISTEMA                   LABORATORIO
    │                          │                          │
    ├─ Crea pedido             │                          │
    │  (create-order-dialog)   │                          │
    │                          │                          │
    └──► INSERT ──────────────►│                          │
         lab_orders            │                          │
         + items               │                          │
                               │                          │
                               ├─ status: "received"      │
                               │                          │
                               └─────────────────────────►│
                                                          │
                                                          ├─ Ve pedido
                                                          │  (/orders)
                                                          │
                                                          ├─ Mueve a
                                                          │  producción
                                                          │  (Kanban)
                                                          │
                                                          ├─ UPDATE
                                                          │  status:
                                                          │  "in_production"
                                                          │
                                                          ├─ Control
                                                          │  calidad
                                                          │
                                                          ├─ UPDATE
                                                          │  status:
                                                          │  "ready"
                                                          │
                               ◄──────────────────────────┤
                               │                          │
    ◄──── Notificación ────────┤                          │
    │                          │                          │
    ├─ Ve actualización        │                          │
    │  (/orders/[id])          │                          │
    │                          │                          │
    └─ Recoge pedido           │                          │
                               │                          │
                               ├─ UPDATE ────────────────►│
                               │  status:                 │
                               │  "delivered"             │
                               │                          │
                               ✅ COMPLETADO              │
```

---

## 🎨 Personalización

### ¿Qué modificar para personalizar tu marca?

```
📁 Colores y Tema
└── app/globals.css
    ├── --primary ......... Color principal
    ├── --accent .......... Color de acento
    ├── --background ...... Fondo
    └── --foreground ...... Texto

📁 Logo y Nombre
├── components/dashboard/sidebar.tsx
│   └── "DentLab" ......... Cambiar nombre
│        "DL" ............. Cambiar iniciales
│
└── components/landing/header.tsx
    └── Logo y navegación

📁 Textos Marketing
└── components/landing/
    ├── hero.tsx .......... Título principal y CTA
    ├── features.tsx ...... Características
    ├── pricing.tsx ....... Planes y precios
    └── footer.tsx ........ Links y copyright

📁 Metadata SEO
└── app/layout.tsx
    ├── title ............. Título del sitio
    └── description ....... Descripción
```

---

## 🧪 Testing y Development

### Flujo de Desarrollo Recomendado

```
1. Local Development
   ├── npm run dev ........... Servidor local
   ├── Ver http://localhost:3000
   └── Hot reload automático

2. Testing
   ├── Crear usuario de prueba
   ├── Probar flujo dentista
   ├── Probar flujo laboratorio
   └── Verificar pedidos

3. Database Changes
   ├── Modificar SQL en scripts/
   ├── Ejecutar en Supabase
   └── Actualizar tipos en código

4. Deploy
   ├── npm run build ......... Build producción
   ├── Verificar errores
   └── Deploy a Vercel/Netlify
```

---

## 📱 Responsive Design

```
MÓVIL (< 768px)
├── Sidebar: Oculto (hamburger menu)
├── Tablas: Scroll horizontal
└── Cards: Stack vertical

TABLET (768px - 1024px)
├── Sidebar: Colapsable
├── Grid: 2 columnas
└── Tablas: Visible

DESKTOP (> 1024px)
├── Sidebar: Siempre visible
├── Grid: 3-4 columnas
└── Tablas: Completas
```

---

**💡 Tip:** Usa esta guía como referencia rápida mientras desarrollas. Combínala con `GUIA_DEL_PROYECTO.md` para detalles completos.
