-- ============================================
-- Fix Ledger Movements Balance
-- ============================================
-- Este script calcula y actualiza el balance en ledger_movements

-- 1. Hacer el campo balance opcional temporalmente (si falla, ignorar)
-- ============================================
DO $$
BEGIN
    ALTER TABLE ledger_movements
    ALTER COLUMN balance DROP NOT NULL;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Column balance already nullable or does not exist';
END $$;

-- 2. Calcular y actualizar balances para movimientos existentes
-- ============================================
DO $$
DECLARE
  v_movement RECORD;
  v_running_balance DECIMAL(10,2);
  v_org_id UUID;
  v_prev_org_id UUID := NULL;
BEGIN
  -- Procesar movimientos ordenados por organización y fecha
  FOR v_movement IN
    SELECT
      id,
      lab_org_id,
      dentist_org_id,
      type,
      amount,
      balance,
      created_at
    FROM ledger_movements
    ORDER BY lab_org_id, dentist_org_id, created_at ASC
  LOOP
    -- Si cambiamos de par de organizaciones, resetear balance
    v_org_id := v_movement.lab_org_id;

    IF v_prev_org_id IS NULL OR v_prev_org_id != v_org_id THEN
      v_running_balance := 0;
      v_prev_org_id := v_org_id;
    END IF;

    -- Calcular nuevo balance
    IF v_movement.type = 'income' THEN
      v_running_balance := v_running_balance + v_movement.amount;
    ELSE
      v_running_balance := v_running_balance - v_movement.amount;
    END IF;

    -- Actualizar registro si no tiene balance o es diferente
    IF v_movement.balance IS NULL OR v_movement.balance != v_running_balance THEN
      UPDATE ledger_movements
      SET balance = v_running_balance,
          updated_at = NOW()
      WHERE id = v_movement.id;

      RAISE NOTICE 'Updated movement % with balance %', v_movement.id, v_running_balance;
    END IF;
  END LOOP;

  RAISE NOTICE 'Ledger movements balance calculation completed';
END $$;

-- 3. Hacer el campo balance obligatorio nuevamente
-- ============================================
ALTER TABLE ledger_movements
ALTER COLUMN balance SET NOT NULL;

-- 4. Agregar campo updated_at si no existe
-- ============================================
DO $$
BEGIN
    ALTER TABLE ledger_movements
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    RAISE NOTICE 'Column updated_at check completed';
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Column updated_at already exists';
END $$;

-- 5. Mensaje final
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Ledger movements fix completed successfully';
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Para verificar que todo está correcto:
-- SELECT * FROM ledger_movements ORDER BY created_at DESC LIMIT 10;
