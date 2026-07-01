import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { mall_type?: string; product_names?: string[] }
    | null
  if (!body || typeof body.mall_type !== 'string' || !Array.isArray(body.product_names)) {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }
  const mallType = body.mall_type.trim()
  const productNames = body.product_names
    .filter((n) => typeof n === 'string')
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
  if (mallType === '') {
    return NextResponse.json({ error: '쇼핑몰이 선택되지 않았습니다' }, { status: 400 })
  }

  // ad_units → brand_id 로 소유권 확인 (RLS)
  const { data: unit, error: unitErr } = await supabase
    .from('ad_units')
    .select('id, brand_id')
    .eq('id', unitId)
    .single()
  if (unitErr || !unit) {
    return NextResponse.json({ error: '광고 단위를 찾을 수 없습니다' }, { status: 404 })
  }

  const admin = createAdminClient()
  // 기존 매핑 삭제 (이 ad_unit + mall_type 조합)
  const { error: delErr } = await admin
    .from('campaign_product_mappings')
    .delete()
    .eq('ad_unit_id', unitId)
    .eq('mall_type', mallType)
  if (delErr) {
    return NextResponse.json({ error: `기존 매핑 삭제 실패: ${delErr.message}` }, { status: 400 })
  }

  if (productNames.length === 0) {
    return NextResponse.json({ ok: true, count: 0 })
  }

  const rows = productNames.map((name) => ({
    brand_id: unit.brand_id,
    ad_unit_id: unitId,
    mall_type: mallType,
    product_name: name,
  }))
  const { error: insErr } = await admin
    .from('campaign_product_mappings')
    .insert(rows)
  if (insErr) {
    return NextResponse.json({ error: `매핑 저장 실패: ${insErr.message}` }, { status: 400 })
  }
  return NextResponse.json({ ok: true, count: rows.length })
}
