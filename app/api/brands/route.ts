import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { pickBrandColor } from '@/lib/brand-colors'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: { name?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: '브랜드 이름을 입력해주세요' }, { status: 400 })
  }
  if (name.length > 50) {
    return NextResponse.json({ error: '브랜드 이름은 50자 이내로 입력해주세요' }, { status: 400 })
  }

  const color = pickBrandColor(name)

  const { data, error } = await supabase
    .from('brands')
    .insert({ name, color, owner_id: user.id })
    .select('id, name, color')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
