import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ brandId: string; mappingId: string }> }
) {
  const { brandId, mappingId } = await ctx.params
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

  const admin = createAdminClient()
  const { error } = await admin
    .from('ad_group_category_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('brand_id', brandId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
