-- Allow dentists to connect to labs and view related lab orgs

-- Dentists can insert lab relations for their own organization
CREATE POLICY "lab_dentist_insert_dentist" ON lab_dentist_relations
  FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), dentist_org_id));

-- Dentists can read lab organizations they are connected to
CREATE POLICY "org_select_related_labs" ON organizations
  FOR SELECT
  USING (
    type = 'lab' AND EXISTS (
      SELECT 1
      FROM lab_dentist_relations ldr
      WHERE ldr.lab_org_id = organizations.id
        AND user_belongs_to_org(auth.uid(), ldr.dentist_org_id)
    )
  );

-- Search labs by name (used for dentist "buscar laboratorio")
CREATE OR REPLACE FUNCTION search_labs(search_term TEXT)
RETURNS TABLE(id UUID, name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name
  FROM organizations o
  WHERE o.type = 'lab'
    AND EXISTS (
      SELECT 1
      FROM org_members om
      JOIN organizations org ON org.id = om.org_id
      WHERE om.user_id = auth.uid()
        AND org.type = 'dentist'
    )
    AND trim(coalesce(search_term, '')) <> ''
    AND o.name ILIKE '%' || trim(search_term) || '%'
  ORDER BY o.name
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_labs(TEXT) TO authenticated;
