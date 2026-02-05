# 📊 Base de Datos - DigitalDent v2

**Documento de Referencia para IA y Desarrollo**

Este documento contiene la estructura completa de la base de datos del proyecto DigitalDent. Debe consultarse antes de realizar cualquier modificación que involucre datos persistentes.

---

## 🗄️ Configuración General

- **Motor:** PostgreSQL
- **ORM:** Prisma 6.18.0
- **Schema:** `public` (default)
- **Ubicación del Schema:** `/prisma/schema.prisma`

### Variables de Entorno Requeridas

```env
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
STRIPE_SECRET="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 📋 Modelos de Datos

### 1. **User** (Usuarios/Pacientes)

**Tabla:** `User`

```prisma
model User {
  id           Int           @id @default(autoincrement())
  email        String        @unique
  name         String?
  reminders    Reminder[]
  appointments Appointment[]
  invoices     Invoice[]
}
```

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | Int | PK, Auto-increment | Identificador único |
| `email` | String | UNIQUE, NOT NULL | Email del usuario |
| `name` | String | NULLABLE | Nombre completo |

**Relaciones:**
- `reminders` → One-to-Many con `Reminder`
- `appointments` → One-to-Many con `Appointment`
- `invoices` → One-to-Many con `Invoice`

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `email`

---

### 2. **Reminder** (Recordatorios)

**Tabla:** `Reminder`

```prisma
model Reminder {
  id        Int             @id @default(autoincrement())
  patientId Int
  orderId   Int?
  channel   ReminderChannel
  sendAt    DateTime
  sentAt    DateTime?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  user      User            @relation(fields: [patientId], references: [id])
}

enum ReminderChannel {
  EMAIL
  SMS
}
```

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | Int | PK, Auto-increment | Identificador único |
| `patientId` | Int | FK → User.id, NOT NULL | ID del paciente |
| `orderId` | Int | NULLABLE | ID de orden relacionada |
| `channel` | Enum | NOT NULL | Canal de envío (EMAIL/SMS) |
| `sendAt` | DateTime | NOT NULL | Fecha/hora programada |
| `sentAt` | DateTime | NULLABLE | Fecha/hora de envío real |
| `createdAt` | DateTime | Default: now() | Fecha de creación |
| `updatedAt` | DateTime | Auto-update | Última modificación |

**Relaciones:**
- `user` → Many-to-One con `User` (via `patientId`)

**Valores del Enum `ReminderChannel`:**
- `EMAIL` - Recordatorio por correo electrónico
- `SMS` - Recordatorio por mensaje de texto

---

### 3. **Appointment** (Citas)

**Tabla:** `Appointment`

```prisma
model Appointment {
  id        Int      @id @default(autoincrement())
  title     String
  start     DateTime
  end       DateTime
  patientId Int
  patient   User     @relation(fields: [patientId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | Int | PK, Auto-increment | Identificador único |
| `title` | String | NOT NULL | Título/descripción de la cita |
| `start` | DateTime | NOT NULL | Fecha/hora de inicio |
| `end` | DateTime | NOT NULL | Fecha/hora de fin |
| `patientId` | Int | FK → User.id, NOT NULL | ID del paciente |
| `createdAt` | DateTime | Default: now() | Fecha de creación |
| `updatedAt` | DateTime | Auto-update | Última modificación |

**Relaciones:**
- `patient` → Many-to-One con `User` (via `patientId`)

**Validaciones Recomendadas:**
- `end` debe ser mayor que `start`
- No permitir overlapping appointments para el mismo horario

---

### 4. **Availability** (Disponibilidad)

**Tabla:** `Availability`

```prisma
model Availability {
  id        Int    @id @default(autoincrement())
  dayOfWeek Int
  startTime String
  endTime   String
}
```

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | Int | PK, Auto-increment | Identificador único |
| `dayOfWeek` | Int | NOT NULL | Día de la semana (0-6) |
| `startTime` | String | NOT NULL | Hora de inicio (formato HH:MM) |
| `endTime` | String | NOT NULL | Hora de fin (formato HH:MM) |

**Convención `dayOfWeek`:**
- `0` = Domingo
- `1` = Lunes
- `2` = Martes
- `3` = Miércoles
- `4` = Jueves
- `5` = Viernes
- `6` = Sábado

**Formato de Tiempo:**
- Usar formato 24 horas: `"09:00"`, `"17:30"`, etc.

---

### 5. **Invoice** (Facturas)

**Tabla:** `Invoice`

```prisma
model Invoice {
  id                    String        @id @default(cuid())
  patientId             Int
  amountCents           Int
  currency              String
  status                InvoiceStatus @default(CREATED)
  stripePaymentIntentId String?       @unique
  createdAt             DateTime      @default(now())
  patient               User          @relation(fields: [patientId], references: [id])
  payments              Payment[]
}

enum InvoiceStatus {
  CREATED
  PAID
  FAILED
}
```

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | String | PK, CUID | Identificador único (CUID) |
| `patientId` | Int | FK → User.id, NOT NULL | ID del paciente |
| `amountCents` | Int | NOT NULL | Monto en centavos |
| `currency` | String | NOT NULL | Código de moneda (ISO 4217) |
| `status` | Enum | Default: CREATED | Estado de la factura |
| `stripePaymentIntentId` | String | UNIQUE, NULLABLE | ID de Stripe PaymentIntent |
| `createdAt` | DateTime | Default: now() | Fecha de creación |

**Relaciones:**
- `patient` → Many-to-One con `User` (via `patientId`)
- `payments` → One-to-Many con `Payment`

**Valores del Enum `InvoiceStatus`:**
- `CREATED` - Factura creada, pendiente de pago
- `PAID` - Factura pagada
- `FAILED` - Pago fallido

**Integración con Stripe:**
- El campo `stripePaymentIntentId` vincula la factura con un PaymentIntent de Stripe
- Usar webhooks para actualizar el status automáticamente

---

### 6. **Payment** (Pagos)

**Tabla:** `Payment`

```prisma
model Payment {
  id          String   @id @default(cuid())
  invoiceId   String
  amountCents Int
  method      String
  status      String
  createdAt   DateTime @default(now())
  invoice     Invoice  @relation(fields: [invoiceId], references: [id])
}
```

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | String | PK, CUID | Identificador único (CUID) |
| `invoiceId` | String | FK → Invoice.id, NOT NULL | ID de la factura |
| `amountCents` | Int | NOT NULL | Monto pagado en centavos |
| `method` | String | NOT NULL | Método de pago (card, cash, etc) |
| `status` | String | NOT NULL | Estado del pago |
| `createdAt` | DateTime | Default: now() | Fecha de creación |

**Relaciones:**
- `invoice` → Many-to-One con `Invoice` (via `invoiceId`)

**Métodos de Pago Comunes:**
- `card` - Tarjeta de crédito/débito
- `cash` - Efectivo
- `transfer` - Transferencia bancaria

---

## 🔗 Diagrama de Relaciones

```
┌─────────────┐
│    User     │
│ (Paciente)  │
└──────┬──────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌─────────────┐    ┌──────────────┐
│  Reminder   │    │ Appointment  │
└─────────────┘    └──────────────┘

       │
       ▼
┌─────────────┐
│   Invoice   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Payment   │
└─────────────┘

┌──────────────┐
│ Availability │  (Standalone - sin FK)
└──────────────┘
```

**Cascadas de Eliminación (implícitas en Prisma):**
- Si se elimina un `User`, se eliminan sus `Reminder`, `Appointment` e `Invoice`
- Si se elimina un `Invoice`, se eliminan sus `Payment`

---

## 🔧 Operaciones Comunes

### Prisma Client - Ejemplos de Uso

#### Crear un Usuario
```typescript
const user = await prisma.user.create({
  data: {
    email: "paciente@example.com",
    name: "Juan Pérez"
  }
})
```

#### Crear una Cita con Paciente
```typescript
const appointment = await prisma.appointment.create({
  data: {
    title: "Limpieza dental",
    start: new Date("2025-03-15T10:00:00"),
    end: new Date("2025-03-15T11:00:00"),
    patientId: 1
  }
})
```

#### Obtener Recordatorios Pendientes
```typescript
const pendingReminders = await prisma.reminder.findMany({
  where: {
    sentAt: null,
    sendAt: {
      lte: new Date()
    }
  },
  include: {
    user: true
  }
})
```

#### Crear Factura con Stripe
```typescript
const invoice = await prisma.invoice.create({
  data: {
    patientId: 1,
    amountCents: 15000, // $150.00
    currency: "USD",
    status: "CREATED",
    stripePaymentIntentId: "pi_xxx"
  }
})
```

#### Actualizar Estado de Factura
```typescript
await prisma.invoice.update({
  where: { id: invoiceId },
  data: { status: "PAID" }
})
```

---

## 📝 Reglas de Negocio

### Appointments (Citas)
1. Una cita debe tener duración mínima de 15 minutos
2. No permitir citas que se solapen en el mismo horario
3. Validar que la cita esté dentro de las horas de disponibilidad
4. Crear recordatorio automático 24 horas antes de la cita

### Reminders (Recordatorios)
1. Un recordatorio solo puede enviarse una vez (`sentAt` no debe cambiar)
2. Validar que `sendAt` sea una fecha futura al crear
3. Marcar `sentAt` con la fecha/hora actual al enviar

### Invoices (Facturas)
1. `amountCents` debe ser positivo
2. Una vez marcada como `PAID`, no puede cambiar a otro estado
3. Al crear invoice, crear un PaymentIntent en Stripe
4. Actualizar status via webhook de Stripe

### Availability (Disponibilidad)
1. `startTime` debe ser menor que `endTime`
2. No permitir overlapping de horarios en el mismo día
3. Validar formato de tiempo (HH:MM en 24h)

---

## 🔐 Consideraciones de Seguridad

### Datos Sensibles
- **Email**: Información personal, requiere validación y encriptación en tránsito
- **Payment Data**: NUNCA almacenar números de tarjeta completos, usar Stripe
- **stripePaymentIntentId**: Mantener confidencial, no exponer en frontend

### Validaciones Requeridas
```typescript
// Validar email
const emailSchema = z.string().email()

// Validar monto
const amountSchema = z.number().positive().int()

// Validar fecha
const dateSchema = z.date().min(new Date())
```

### Acceso a Datos
- Implementar Row Level Security (RLS) si se usa Supabase
- Validar que un usuario solo acceda a sus propios datos
- Usar middleware de autenticación en todos los endpoints

---

## 🚀 Migraciones

### Comandos Prisma

```bash
# Generar migración
npx prisma migrate dev --name descripcion_cambio

# Aplicar migraciones
npx prisma migrate deploy

# Resetear base de datos (desarrollo)
npx prisma migrate reset

# Generar Prisma Client
npx prisma generate

# Abrir Prisma Studio
npx prisma studio
```

### Convenciones de Nombres de Migraciones
- `add_user_avatar` - Agregar campo avatar a User
- `create_payments_table` - Crear tabla Payment
- `alter_invoice_status_enum` - Modificar enum InvoiceStatus
- `add_index_email` - Agregar índice a email

---

## 📚 Seed Data (Datos de Prueba)

**Ubicación:** `/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Crear usuario de prueba
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User'
    }
  })

  // Crear citas de prueba
  await prisma.appointment.createMany({
    data: [
      {
        title: 'Consulta inicial',
        start: new Date('2025-03-01T10:00:00'),
        end: new Date('2025-03-01T11:00:00'),
        patientId: user.id
      },
      {
        title: 'Limpieza dental',
        start: new Date('2025-03-15T14:00:00'),
        end: new Date('2025-03-15T15:00:00'),
        patientId: user.id
      }
    ]
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Ejecutar seed:**
```bash
npx prisma db seed
```

---

## 🔍 Endpoints API

### Appointments
- `GET /api/appointments` - Listar citas
- `POST /api/appointments` - Crear cita
- `GET /api/appointments/[id]` - Obtener cita
- `PATCH /api/appointments/[id]` - Actualizar cita
- `DELETE /api/appointments/[id]` - Eliminar cita

### Reminders
- `GET /api/reminders` - Listar recordatorios
- `POST /api/reminders` - Crear recordatorio
- `GET /api/reminders/[id]` - Obtener recordatorio
- `PATCH /api/reminders/[id]` - Actualizar recordatorio
- `DELETE /api/reminders/[id]` - Eliminar recordatorio

### Availability
- `GET /api/availability` - Obtener horarios disponibles
- `POST /api/availability` - Crear horario

### Billing
- `POST /api/billing/checkout` - Crear PaymentIntent
- `POST /api/billing/webhook` - Webhook de Stripe

---

## 📊 Índices Recomendados

```prisma
// En schema.prisma

model Reminder {
  // ... campos existentes
  @@index([sendAt])
  @@index([patientId])
}

model Appointment {
  // ... campos existentes
  @@index([start, end])
  @@index([patientId])
}

model Invoice {
  // ... campos existentes
  @@index([patientId])
  @@index([status])
}
```

---

## 🧪 Testing

### Datos de Prueba
```typescript
// Crear un usuario mock
const mockUser = {
  id: 1,
  email: "test@example.com",
  name: "Test User"
}

// Crear una cita mock
const mockAppointment = {
  id: 1,
  title: "Test Appointment",
  start: new Date("2025-03-01T10:00:00"),
  end: new Date("2025-03-01T11:00:00"),
  patientId: 1
}
```

---

## ⚠️ Notas Importantes para IA

### Antes de Modificar la Base de Datos

1. **SIEMPRE** consulta este documento primero
2. **VERIFICA** las relaciones existentes antes de agregar FKs
3. **VALIDA** que los cambios no rompan queries existentes
4. **CONSIDERA** el impacto en los endpoints API
5. **CREA** una migración con nombre descriptivo
6. **ACTUALIZA** este documento después de cualquier cambio

### Cambios Comunes y Cómo Hacerlos

#### Agregar un Campo
```prisma
model User {
  // ... campos existentes
  phone String? // Nuevo campo opcional
}
```
**Migración:** `npx prisma migrate dev --name add_user_phone`

#### Agregar una Tabla Nueva
```prisma
model Treatment {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  cost        Int
  createdAt   DateTime @default(now())
}
```
**Migración:** `npx prisma migrate dev --name create_treatments_table`

#### Modificar una Relación
```prisma
model Appointment {
  // ... campos existentes
  treatments Treatment[] // Agregar relación many-to-many
}

model Treatment {
  // ... campos existentes
  appointments Appointment[]
}
```
**Requiere:** Tabla intermedia y migración compleja

---

## 📞 Contacto y Soporte

- **Documentación Prisma:** https://www.prisma.io/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs
- **Stripe API:** https://stripe.com/docs/api

---

**Última Actualización:** 2025-02-05
**Versión del Schema:** 1.0
**Compatibilidad:** Prisma 6.18.0 + PostgreSQL 14+

---

## 🎯 Checklist para Cambios en BD

Antes de modificar la base de datos, verifica:

- [ ] Consulté este documento de referencia
- [ ] Entiendo las relaciones afectadas
- [ ] Validé el impacto en los endpoints API
- [ ] Creé una migración con nombre descriptivo
- [ ] Actualicé la documentación
- [ ] Actualicé los tipos de TypeScript
- [ ] Probé en ambiente de desarrollo
- [ ] Actualicé los tests correspondientes
