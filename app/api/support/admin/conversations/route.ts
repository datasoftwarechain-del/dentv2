import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const adminEmail = process.env.SUPPORT_ADMIN_EMAIL
  if (!adminEmail || !user.email || !timingSafeEqual(user.email, adminEmail)) {
    logger.security(`Unauthorized admin support access attempt by user ${user.id} (${user.email ?? 'no-email'})`)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: messages, error } = await admin
    .from('support_messages')
    .select('id, user_id, content, sender_type, created_at, is_read')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Obtener info de usuarios únicos
  const userIds = [...new Set((messages || []).map((m: any) => m.user_id))]
  const userInfo: Record<string, { name: string; email: string }> = {}

  for (const uid of userIds) {
    const { data: userData } = await admin.auth.admin.getUserById(uid as string)
    if (userData?.user) {
      const meta = userData.user.user_metadata || {}
      const firstName = meta.first_name || ''
      const lastName = meta.last_name || ''
      const fullName = [firstName, lastName].filter(Boolean).join(' ')
      userInfo[uid as string] = {
        name: fullName || userData.user.email || uid as string,
        email: userData.user.email || uid as string,
      }
    }
  }

  // Agrupar por user_id (messages ya viene desc por fecha, el primero es el más reciente)
  const conversations: Record<string, any> = {}
  for (const msg of (messages || [])) {
    if (!conversations[msg.user_id]) {
      conversations[msg.user_id] = {
        user_id: msg.user_id,
        user_name: userInfo[msg.user_id]?.name || msg.user_id,
        user_email: userInfo[msg.user_id]?.email || msg.user_id,
        last_message: msg.content,
        last_activity: msg.created_at,
        unread_count: 0,
      }
    }
    if (!msg.is_read && msg.sender_type === 'user') {
      conversations[msg.user_id].unread_count++
    }
  }

  return NextResponse.json({ conversations: Object.values(conversations) })
}
