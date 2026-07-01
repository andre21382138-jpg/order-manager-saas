import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ brandId: string; mappingId: string }> }
) {
  const { brandId, mappingId } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { category_id?: string | null } | null
  if (!body || (body.category_id !== null && typeof body.category_id !== 'string')) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('product_category_mappings')
    .select('id, brand_id')
    .eq('id', mappingId)
    .single()
  if (!existing || existing.brand_id !== brandId) {
    return NextResponse.json({ error: '매핑을 찾을 수 없습니다' }, { status: 404 })
  }

  const admin = createAdminClient()

  if (body.category_id === null) {
    const { error } = await admin
      .from('product_category_mappings')
      .delete()
      .eq('id', mappingId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deleted: true })
  }

  const { data: cat } = await supabase
    .from('product_categories')
    .select('id, brand_id')
    .eq('id', body.category_id)
    .single()
  if (!cat || cat.brand_id !== brandId) {
    return NextResponse.json({ error: '카테고리를 찾을 수 없습니다' }, { status: 404 })
  }

  const { error } = await admin
    .from('product_category_mappings')
    .update({ category_id: body.category_id })
    .eq('id', mappingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
