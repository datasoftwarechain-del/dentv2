-- Script para corregir tipos de movimientos y recalcular balances
-- Los cobros/pagos deben ser tipo 'payment' (abono) no 'charge'

-- 1. Corregir movimientos que son cobros/pagos pero se guardaron como 'charge'
-- Asumimos que todos los movimientos actuales son pagos recibidos
UPDATE ledger_movements
SET type = 'payment'
WHERE type = 'charge';

-- 2. Recalcular todos los balances correctamente
-- Primero hacemos el balance nullable temporalmente
ALTER TABLE ledger_movements ALTER COLUMN balance DROP NOT NULL;

-- 3. Recalcular balances para cada par de organizaciones
DO $$
DECLARE
  rec RECORD;
  mov RECORD;
  running_balance NUMERIC := 0;
  invoice_total NUMERIC := 0;
BEGIN
  -- Procesar cada combinación única de dentist_org_id y lab_org_id
  FOR rec IN (
    SELECT DISTINCT
      COALESCE(dentist_org_id::text, 'NULL') as dentist_id,
      COALESCE(lab_org_id::text, 'NULL') as lab_id,
      dentist_org_id,
      lab_org_id
    FROM ledger_movements
    ORDER BY dentist_id, lab_id
  ) LOOP
    -- Iniciar balance en 0 para esta relación
    running_balance := 0;

    -- Calcular total de facturas para esta relación
    SELECT COALESCE(SUM(total), 0) INTO invoice_total
    FROM invoices
    WHERE dentist_org_id = rec.dentist_org_id
      AND lab_org_id = rec.lab_org_id;

    -- El balance inicial es el total facturado
    running_balance := invoice_total;

    -- Actualizar cada movimiento en orden cronológico
    FOR mov IN (
      SELECT id, type, amount, created_at
      FROM ledger_movements
      WHERE (dentist_org_id = rec.dentist_org_id OR (dentist_org_id IS NULL AND rec.dentist_org_id IS NULL))
        AND (lab_org_id = rec.lab_org_id OR (lab_org_id IS NULL AND rec.lab_org_id IS NULL))
      ORDER BY created_at ASC, id ASC
    ) LOOP
      -- Payments reducen el balance (son abonos)
      IF mov.type = 'payment' THEN
        running_balance := running_balance - mov.amount;
      -- Charges aumentan el balance (son cargos adicionales)
      ELSIF mov.type = 'charge' THEN
        running_balance := running_balance + mov.amount;
      END IF;

      -- Actualizar el balance de este movimiento
      UPDATE ledger_movements
      SET balance = running_balance
      WHERE id = mov.id;
    END LOOP;
  END LOOP;
END $$;

-- 4. Volver a hacer el balance NOT NULL
ALTER TABLE ledger_movements ALTER COLUMN balance SET NOT NULL;

-- 5. Verificar resultado
DO $$
BEGIN
  RAISE NOTICE 'Migración completada. Movimientos actualizados.';
  RAISE NOTICE 'Total de movimientos tipo payment: %', (SELECT COUNT(*) FROM ledger_movements WHERE type = 'payment');
  RAISE NOTICE 'Total de movimientos tipo charge: %', (SELECT COUNT(*) FROM ledger_movements WHERE type = 'charge');
END $$;
