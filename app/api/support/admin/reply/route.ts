import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateBody } from '@/lib/api-validation'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) { result |= a.charCodeAt(i) ^ b.charCodeAt(i); }
  return result === 0;
}

const ReplySchema = z.object({
  userId: z.string().uuid("userId debe ser un UUID válido"),
  content: z.string().min(1, "El contenido no puede estar vacío").max(2000),
});

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const adminEmail = process.env.SUPPORT_ADMIN_EMAIL
  if (!adminEmail || !user.email || !timingSafeEqual(user.email, adminEmail)) {
    logger.security(`Unauthorized admin reply attempt by user ${user.id} (${user.email ?? 'no-email'})`)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const validation = await validateBody(request as any, ReplySchema)
  if (validation.error) return validation.error
  const { userId, content } = validation.data

  if (!userId || !content || !content.trim()) {
    return NextResponse.json({ error: 'userId y content requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('support_messages')
    .insert({
      user_id: userId,
      content: content.trim(),
      sender_type: 'support',
    })
    .select('id, content, sender_type, created_at, is_read')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
