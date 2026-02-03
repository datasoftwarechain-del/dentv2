-- ============================================
-- FIX PERMISSIONS AND AUTOMATION
-- ============================================

-- 1. Enable Organizations creation
-- Allow authenticated users to create organizations
CREATE POLICY "org_insert" ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Automate Owner Assignment
-- When an org is created, automatically add the creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_organization() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE TRIGGER on_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- 3. Fix Storage Bucket (Run this manually if needed, or via migration)
-- Attempt to create bucket if it doesn't exist (requires specific privileges often not available in standard migrations, 
-- usually done via UI, but including policy logic here)

-- Ensure policies exist for order_files
-- (Assuming bucket 'order_files' exists)

-- Policy to allow viewing files (if you belong to the org)
CREATE POLICY "order_files_select_storage" ON storage.objects FOR SELECT
  USING (bucket_id = 'order_files' AND (
      EXISTS (
        SELECT 1 FROM lab_orders lo
        WHERE lo.id::text = (storage.foldername(name))[1]
        AND (
            user_belongs_to_org(auth.uid(), lo.lab_org_id) OR 
            user_belongs_to_org(auth.uid(), lo.dentist_org_id)
        )
      )
  ));

-- Policy to allow uploading files (if you belong to source/dest org)
CREATE POLICY "order_files_insert_storage" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'order_files' AND (
      EXISTS (
        SELECT 1 FROM lab_orders lo
        WHERE lo.id::text = (storage.foldername(name))[1]
        AND (
            user_belongs_to_org(auth.uid(), lo.lab_org_id) OR 
            user_belongs_to_org(auth.uid(), lo.dentist_org_id)
        )
      )
  ));
