import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { cost?: number | null } | null
  if (!body || (body.cost !== null && (typeof body.cost !== 'number' || isNaN(body.cost)))) {
    return NextResponse.json({ error: '유효하지 않은 원가' }, { status: 400 })
  }
  const newCost = body.cost === null ? null : Math.max(0, body.cost)

  // RLS: catalog_products는 brand_id로 owner 검증. 본인 상품만 조회됨.
  const { data: cp } = await supabase
    .from('catalog_products')
    .select('id, brand_id')
    .eq('id', id)
    .single()
  if (!cp) return NextResponse.json({ error: '상품을 찾을 수 없습니다' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('catalog_products')
    .update({ cost: newCost, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: `원가 저장 실패: ${error.message}` }, { status: 400 })
  }
  return NextResponse.json({ ok: true, cost: newCost })
}
