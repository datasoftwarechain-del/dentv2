-- ============================================================
-- 031 - Persistencia de descuento por factura
-- ============================================================
-- Antes: el descuento se computaba client-side y se "absorbía" en el
-- campo `total` (subtotal-pre-descuento, total post-descuento). Eso
-- rompía la invariante `subtotal + tax_amount = total` y borraba
-- trazabilidad: una factura con descuento del 10% no se distinguía de
-- una sin descuento con subtotal menor.
--
-- Ahora persistimos el descuento como dato real:
--   - discount_type ∈ {percent, amount, NULL}
--   - discount_value: lo que tipeó el usuario (10 si es 10%, o 500 si es $500)
--   - discount_amount: el monto en pesos ya resuelto (siempre en moneda)
--
-- Invariante esperada: total = subtotal − discount_amount + tax_amount.
-- El motor TS/SQL de cálculo no se toca: solo persistimos los 3 campos
-- nuevos que el form ya calcula.
--
-- Las facturas existentes nacen con discount_type=NULL,
-- discount_value=NULL, discount_amount=0. NO se recalculan retroactivos:
-- las que ya tenían descuento "absorbido" en `total` quedan así para no
-- pisar montos históricos. Solo aplica a futuro.
--
-- Idempotente. Aplicar manualmente desde Supabase SQL Editor.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type   TEXT,
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Constraints (idempotentes vía DO block — los CHECK no soportan IF NOT EXISTS).
DO $$
BEGIN
  -- discount_type: percent | amount | NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_discount_type_chk'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_discount_type_chk
      CHECK (discount_type IN ('percent', 'amount') OR discount_type IS NULL);
  END IF;

  -- discount_value ≥ 0 (NULL aceptado)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_discount_value_chk'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_discount_value_chk
      CHECK (discount_value IS NULL OR discount_value >= 0);
  END IF;

  -- discount_amount ≥ 0 (siempre persistido)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_discount_amount_chk'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_discount_amount_chk
      CHECK (discount_amount >= 0);
  END IF;
END $$;

COMMENT ON COLUMN invoices.discount_type IS
  'percent | amount | NULL si no hay descuento explícito';

COMMENT ON COLUMN invoices.discount_value IS
  'Valor original tipeado por el usuario (10 si es 10%, 500 si es $500). NULL cuando discount_type=NULL.';

COMMENT ON COLUMN invoices.discount_amount IS
  'Monto del descuento ya calculado en pesos (display + auditoría). NUNCA recalcular en backend desde value: el backend persiste lo que el form envía. Invariante: total = subtotal − discount_amount + tax_amount.';
