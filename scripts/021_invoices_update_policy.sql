-- Script para agregar política de UPDATE a invoices
-- Esto permite editar facturas manualmente

-- Verificar si la política ya existe y eliminarla si es necesario
DROP POLICY IF EXISTS "invoices_update" ON invoices;

-- Política para UPDATE: permitir a usuarios de organizaciones actualizar facturas
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
    AND (om.org_id = invoices.dentist_org_id OR om.org_id = invoices.lab_org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
    AND (om.org_id = invoices.dentist_org_id OR om.org_id = invoices.lab_org_id)
  )
);

-- Verificar la política creada
DO $$
BEGIN
  RAISE NOTICE 'Política de UPDATE creada para invoices';
END $$;
