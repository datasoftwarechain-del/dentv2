import { createClient } from '@/lib/supabase/server';

interface OrgBasic {
  id: string;
  type: string;
  is_system_account: boolean | null;
}

/**
 * Resuelve la org principal del usuario para uso en API routes.
 * A diferencia de getUserOrg(), devuelve null en vez de redirect()
 * para que los API routes puedan responder con 401/403 apropiados.
 */
export async function getOrgForApiRoute(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgBasic | null> {
  const { data: memberships } = await supabase
    .from('org_members')
    .select('organization:org_id(id, type, is_system_account)')
    .eq('user_id', userId);

  const orgs = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any) => o && o.is_system_account !== false);

  return (orgs[0] as OrgBasic) ?? null;
}

/**
 * Verifica que un usuario pertenece a una organización
 * @param userId - ID del usuario autenticado
 * @param organizationId - ID de la organización a verificar
 * @returns true si el usuario es miembro de la organización
 */
export async function verifyUserOwnsOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('org_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', organizationId)
    .single();

  return !!data && !error;
}

/**
 * Verifica que un usuario tiene acceso a un movimiento de ledger
 * @param userId - ID del usuario autenticado
 * @param movementId - ID del movimiento a verificar
 * @returns true si el usuario pertenece a alguna de las organizaciones del movimiento
 */
export async function verifyUserOwnsMovement(
  userId: string,
  movementId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Obtener movimiento con las organizaciones
  const { data: movement, error } = await supabase
    .from('ledger_movements')
    .select('dentist_org_id, lab_org_id')
    .eq('id', movementId)
    .single();

  if (error || !movement) {
    console.error('[AUTH] Movement not found or error:', error);
    return false;
  }

  // Verificar si el usuario pertenece a alguna de las organizaciones
  const dentistCheck = await verifyUserOwnsOrganization(userId, movement.dentist_org_id);

  if (dentistCheck) return true;

  // Si hay lab_org_id, verificar también
  if (movement.lab_org_id) {
    const labCheck = await verifyUserOwnsOrganization(userId, movement.lab_org_id);
    if (labCheck) return true;
  }

  return false;
}

/**
 * Verifica que un usuario tiene acceso a una factura
 * @param userId - ID del usuario autenticado
 * @param invoiceId - ID de la factura a verificar
 * @returns true si el usuario pertenece a alguna de las organizaciones de la factura
 */
export async function verifyUserOwnsInvoice(
  userId: string,
  invoiceId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Obtener factura con las organizaciones
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('dentist_org_id, lab_org_id')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    console.error('[AUTH] Invoice not found or error:', error);
    return false;
  }

  // Verificar si el usuario pertenece a alguna de las organizaciones
  const dentistCheck = await verifyUserOwnsOrganization(userId, invoice.dentist_org_id);

  if (dentistCheck) return true;

  // Si hay lab_org_id, verificar también
  if (invoice.lab_org_id) {
    const labCheck = await verifyUserOwnsOrganization(userId, invoice.lab_org_id);
    if (labCheck) return true;
  }

  return false;
}
