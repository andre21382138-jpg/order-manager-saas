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

  const body = (await request.json().catch(() => null)) as { category_ids?: string[] } | null
  if (!body || !Array.isArray(body.category_ids)) {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }
  const categoryIds = body.category_ids
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const { data: unit, error: unitErr } = await supabase
    .from('ad_units')
    .select('id, brand_id')
    .eq('id', unitId)
    .single()
  if (unitErr || !unit) {
    return NextResponse.json({ error: '광고 단위를 찾을 수 없습니다' }, { status: 404 })
  }

  // 모든 category_id가 해당 브랜드 소유인지 검증
  if (categoryIds.length > 0) {
    const { data: cats, error: catErr } = await supabase
      .from('product_categories')
      .select('id')
      .in('id', categoryIds)
      .eq('brand_id', unit.brand_id)
    if (catErr) {
      return NextResponse.json({ error: catErr.message }, { status: 500 })
    }
    if ((cats?.length ?? 0) !== categoryIds.length) {
      return NextResponse.json({ error: '유효하지 않은 카테고리가 포함됨' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  const { error: delErr } = await admin
    .from('campaign_product_mappings')
    .delete()
    .eq('ad_unit_id', unitId)
  if (delErr) {
    return NextResponse.json({ error: `기존 매핑 삭제 실패: ${delErr.message}` }, { status: 500 })
  }

  if (categoryIds.length === 0) {
    return NextResponse.json({ ok: true, count: 0 })
  }

  const rows = categoryIds.map((cid) => ({
    brand_id: unit.brand_id,
    ad_unit_id: unitId,
    category_id: cid,
  }))
  const { error: insErr } = await admin
    .from('campaign_product_mappings')
    .insert(rows)
  if (insErr) {
    return NextResponse.json({ error: `매핑 저장 실패: ${insErr.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: rows.length })
}
