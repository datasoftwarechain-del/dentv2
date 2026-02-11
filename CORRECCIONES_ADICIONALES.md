# 🔧 CORRECCIONES ADICIONALES - FACTURACIÓN

## ✅ PROBLEMAS CORREGIDOS

### 1. **Error al enviar email** ✓
   - **Causa:** Servicio de email no configurado bloqueaba UI
   - **Solución:** Email ahora es opcional, muestra mensaje informativo

### 2. **Cobros no se registran correctamente** ✓
   - **Causa:** Faltaba calcular campo `balance` requerido
   - **Solución:** Ahora calcula balance correctamente antes de insertar

### 3. **Falta sumatoria total en estado de cuenta** ✓
   - **Causa:** No había TableFooter con totales
   - **Solución:** Agregada fila de totales al final de la tabla

---

## 📝 ACCIÓN REQUERIDA

### ⚠️ EJECUTAR SCRIPT SQL

**Archivo:** `/scripts/018_fix_ledger_balance.sql`

Este script:
- ✅ Calcula balance para movimientos existentes
- ✅ Corrige registros sin balance
- ✅ Agrega campo `updated_at`

**Pasos:**
1. Ve a Supabase Dashboard → SQL Editor
2. Copia contenido de `/scripts/018_fix_ledger_balance.sql`
3. Pégalo y ejecuta (RUN)

---

## 🎯 DESPUÉS DE EJECUTAR EL SCRIPT

### 1. Reinicia el servidor

```bash
# Detén el servidor (Ctrl+C)
npm run dev
```

### 2. Prueba Registrar Cobro

1. Ve a: `/dashboard/billing`
2. Haz clic en cualquier cliente
3. Clic en **"REGISTRAR COBRO"**
4. Completa:
   - **Monto:** 100
   - **Descripción:** "Pago de prueba"
5. Clic en **"Registrar"**

**Resultado esperado:**
- ✅ Toast: "Cobro registrado correctamente"
- ✅ Aparece en pestaña "Movimientos"
- ✅ Saldo se actualiza automáticamente
- ✅ Tabla muestra el nuevo movimiento

### 3. Verifica Totales en Tabla

En la tabla de facturas, al final deberías ver:

```
┌─────────┬─────────┬─────────┬──────────┬──────────┬──────────┬──────────┐
│ ...facturas...                                                          │
├─────────┴─────────┴─────────┴──────────┴──────────┴──────────┴──────────┤
│ TOTALES              │ $2,500  │          │ Pagado: $0        │         │
│                      │         │          │ Pendiente: $2,500 │         │
└──────────────────────┴─────────┴──────────┴───────────────────┴─────────┘
```

### 4. Prueba Email (opcional)

Al hacer clic en "Email":
- ❌ ANTES: Error "Failed to send email"
- ✅ AHORA: Mensaje: "Funcionalidad de email en desarrollo..."

---

## 📊 CAMBIOS TÉCNICOS

### Archivos Modificados:

1. **`/components/billing/invoice-actions.tsx`**
   - Email ahora es opcional
   - Muestra mensaje informativo

2. **`/components/billing/billing-dashboard.tsx`**
   - Calcula balance antes de insertar
   - Maneja errores correctamente
   - Toast de éxito/error

3. **`/components/billing/client-account-statement.tsx`**
   - Calcula balance específico por cliente
   - Agregado TableFooter con totales
   - Muestra Pagado/Pendiente

4. **`/scripts/018_fix_ledger_balance.sql`** (NUEVO)
   - Corrige balances existentes
   - Agrega campo updated_at

---

## 🔍 VERIFICACIÓN

### Consulta SQL para verificar balances

```sql
-- Ver movimientos con balance calculado
SELECT
  id,
  type,
  amount,
  balance,
  description,
  created_at
FROM ledger_movements
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
- Todos los registros tienen `balance` lleno
- Balance aumenta con `income`
- Balance disminuye con `expense`

### Consulta para ver estado de cuenta

```sql
-- Ver estado de cuenta completo
SELECT
  lab_org_id,
  dentist_org_id,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
  MAX(balance) as current_balance
FROM ledger_movements
GROUP BY lab_org_id, dentist_org_id;
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: "Balance cannot be null"

**Causa:** No ejecutaste el script 018
**Solución:** Ejecuta `/scripts/018_fix_ledger_balance.sql`

### Problema: "Cobro no aparece en Movimientos"

**Solución:**
1. Verifica que el script se ejecutó sin errores
2. Refresca la página (F5)
3. Verifica en Supabase que el registro existe:

```sql
SELECT * FROM ledger_movements
ORDER BY created_at DESC
LIMIT 5;
```

### Problema: "Los totales no aparecen"

**Solución:**
1. Limpia caché del navegador (Cmd/Ctrl + Shift + R)
2. Reinicia el servidor de desarrollo
3. Verifica que estés viendo la tabla de facturas, no movimientos

---

## 💡 CÓMO FUNCIONA EL BALANCE

### Ejemplo:

```
Saldo inicial: $0

1. Cliente genera factura: $500
   Balance: $500 (deuda)

2. Registramos cobro: $200
   Balance: $300 (deuda restante)

3. Registramos cobro: $300
   Balance: $0 (pagado completo)
```

El balance se calcula automáticamente:
- **Income (cobro):** Balance aumenta
- **Expense (pago):** Balance disminuye

---

## 📋 CHECKLIST DE VERIFICACIÓN

Después de ejecutar el script:

- [ ] Script SQL ejecutado sin errores
- [ ] Servidor reiniciado
- [ ] Registré un cobro de prueba
- [ ] El cobro aparece en "Movimientos"
- [ ] El saldo se actualizó
- [ ] La tabla muestra totales al final
- [ ] Email ya no genera error
- [ ] Balance se calcula correctamente

---

## 🎉 RESULTADO FINAL

**ANTES:**
- ❌ Error al hacer clic en Email
- ❌ Cobros no se registran
- ❌ No hay totales en tabla

**DESPUÉS:**
- ✅ Email muestra mensaje informativo
- ✅ Cobros se registran correctamente
- ✅ Saldo se actualiza automáticamente
- ✅ Totales visibles al final de tabla
- ✅ Balance calculado correctamente

---

## 🔐 CONFIGURAR EMAIL (OPCIONAL)

Para habilitar envío real de emails:

1. Crea cuenta en [Resend](https://resend.com)
2. Obtén API Key
3. Instala: `npm install resend`
4. Agrega a `.env.local`:
   ```
   RESEND_API_KEY=tu_api_key
   ```
5. En `/components/billing/invoice-actions.tsx`:
   - Descomenta el código del bloque de email
   - Comenta el `toast.info`

---

**¡Todo listo!** Ejecuta el script 018 y las correcciones estarán activas. 🚀
