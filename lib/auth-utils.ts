import { createClient } from '@/lib/supabase/server';

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
