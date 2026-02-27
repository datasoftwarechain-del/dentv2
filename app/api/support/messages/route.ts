import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('support_messages')
    .select('id, content, sender_type, created_at, is_read')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { content } = await request.json()

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      user_id: user.id,
      content: content.trim(),
      sender_type: 'user',
    })
    .select('id, content, sender_type, created_at, is_read')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
