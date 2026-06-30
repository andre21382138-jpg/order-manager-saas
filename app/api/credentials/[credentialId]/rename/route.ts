import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ credentialId: string }> }
) {
  const { credentialId } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { channel_account?: string } | null
  const newName = (body?.channel_account ?? '').trim()
  if (!newName) {
    return NextResponse.json({ error: '별칭이 비어있습니다' }, { status: 400 })
  }

  // RLS로 본인 brand의 credential만 조회
  const { data: cred } = await supabase
    .from('brand_credentials')
    .select('id, brand_id, channel, channel_account')
    .eq('id', credentialId)
    .single()

  if (!cred) {
    return NextResponse.json({ error: '자격증명을 찾을 수 없습니다' }, { status: 404 })
  }

  if (cred.channel_account === newName) {
    return NextResponse.json({ ok: true, channel_account: newName })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('brand_credentials')
    .update({ channel_account: newName })
    .eq('id', credentialId)

  if (error) {
    const msg = error.message.includes('unique')
      ? `같은 이름의 ${cred.channel} 별칭이 이미 있습니다`
      : `별칭 변경 실패: ${error.message}`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true, channel_account: newName })
}
