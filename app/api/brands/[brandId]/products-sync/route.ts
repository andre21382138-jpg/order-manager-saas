import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: brand } = await supabase
    .from('brands')
    .select('id, owner_id')
    .eq('id', brandId)
    .single()
  if (!brand || brand.owner_id !== user.id) {
    return NextResponse.json({ error: '브랜드를 찾을 수 없습니다' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const mall = typeof body?.mall === 'string' ? body.mall.trim() : ''
  if (!mall) {
    return NextResponse.json({ error: 'mall 필수' }, { status: 400 })
  }

  const { data: cred } = await supabase
    .from('brand_credentials')
    .select('id, channel, channel_account')
    .eq('brand_id', brandId)
    .eq('channel', 'cafe24')
    .eq('channel_account', mall)
    .single()
  if (!cred) {
    return NextResponse.json(
      { error: '카페24 스토어만 상품 동기화를 지원합니다' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: inserted, error: insErr } = await admin
    .from('sync_jobs')
    .insert({
      brand_id: brandId,
      credential_id: cred.id,
      channel: 'cafe24',
      job_type: 'products',
      status: 'pending',
    })
    .select('id')
    .single()
  if (insErr) {
    return NextResponse.json({ error: `잡 등록 실패: ${insErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, jobId: inserted.id })
}
