import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) { result |= a.charCodeAt(i) ^ b.charCodeAt(i); }
  return result === 0;
}

// GET /api/support/admin/messages?userId=xxx
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const adminEmail = process.env.SUPPORT_ADMIN_EMAIL
  if (!adminEmail || !user.email || !timingSafeEqual(user.email, adminEmail)) {
    logger.security(`Unauthorized admin messages access by user ${user.id} (${user.email ?? 'no-email'})`)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('support_messages')
    .select('id, content, sender_type, created_at, is_read')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Marcar mensajes del usuario como leídos
  await admin
    .from('support_messages')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('sender_type', 'user')
    .eq('is_read', false)

  return NextResponse.json({ messages: data })
}
