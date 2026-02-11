-- Script para agregar políticas de UPDATE y DELETE a ledger_movements
-- Esto permite editar y eliminar movimientos contables

-- Política para UPDATE: permitir a usuarios de organizaciones actualizarledger movements
CREATE POLICY "ledger_update" ON ledger_movements FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
    AND (om.org_id = ledger_movements.dentist_org_id OR om.org_id = ledger_movements.lab_org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
    AND (om.org_id = ledger_movements.dentist_org_id OR om.org_id = ledger_movements.lab_org_id)
  )
);

-- Política para DELETE: permitir a usuarios de organizaciones eliminar ledger movements
CREATE POLICY "ledger_delete" ON ledger_movements FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
    AND (om.org_id = ledger_movements.dentist_org_id OR om.org_id = ledger_movements.lab_org_id)
  )
);

-- Verificar las políticas creadas
DO $$
BEGIN
  RAISE NOTICE 'Políticas de UPDATE y DELETE creadas para ledger_movements';
END $$;
