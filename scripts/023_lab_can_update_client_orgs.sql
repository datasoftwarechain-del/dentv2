-- =============================================
-- 023_lab_can_update_client_orgs.sql
-- Allow lab members to update contact info of dentist orgs they have orders with
-- =============================================

-- Drop any conflicting policy
DROP POLICY IF EXISTS "lab_update_client_contact" ON organizations;

-- Labs can update contact fields (phone, email, address, city, tax_id, settings)
-- for dentist orgs that have sent them at least one order
CREATE POLICY "lab_update_client_contact" ON organizations
  FOR UPDATE USING (
    -- The org being updated is a dentist org
    type = 'dentist'
    AND
    -- The current user belongs to a lab that has orders from this dentist org
    id IN (
      SELECT DISTINCT lo.dentist_org_id
      FROM lab_orders lo
      WHERE lo.lab_org_id IN (
        SELECT om.org_id
        FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    type = 'dentist'
    AND
    id IN (
      SELECT DISTINCT lo.dentist_org_id
      FROM lab_orders lo
      WHERE lo.lab_org_id IN (
        SELECT om.org_id
        FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );
