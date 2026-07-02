import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: mappings, error: mErr } = await supabase
    .from('product_category_mappings')
    .select('id, product_name, product_no, category_id, product_categories(name)')
    .eq('brand_id', brandId)
    .order('product_name')
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 })
  }

  const { data: categories, error: cErr } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('brand_id', brandId)
    .order('name')
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 })
  }

  const shaped = (mappings ?? []).map((m) => {
    const cat = m.product_categories as unknown as { name: string } | null
    return {
      id: m.id,
      productName: m.product_name,
      productNo: m.product_no,
      categoryId: m.category_id,
      categoryName: cat?.name ?? '',
    }
  })
  return NextResponse.json({ mappings: shaped, categories: categories ?? [] })
}

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
  const productNo = typeof body?.product_no === 'string' ? body.product_no.trim() : ''
  const productName = typeof body?.product_name === 'string' ? body.product_name : null
  const categoryId = typeof body?.category_id === 'string' ? body.category_id : ''
  if (!productNo || !categoryId) {
    return NextResponse.json(
      { error: 'product_no, category_id 필수' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // 카테고리 소유권 확인
  const { data: cat } = await admin
    .from('product_categories')
    .select('id, brand_id')
    .eq('id', categoryId)
    .single()
  if (!cat || cat.brand_id !== brandId) {
    return NextResponse.json({ error: '유효하지 않은 상품구분' }, { status: 400 })
  }

  const { data: inserted, error: insErr } = await admin
    .from('product_category_mappings')
    .upsert(
      {
        brand_id: brandId,
        category_id: categoryId,
        product_no: productNo,
        product_name: productName,
      },
      { onConflict: 'brand_id,product_no' }
    )
    .select('id')
    .single()
  if (insErr) {
    return NextResponse.json({ error: `매핑 저장 실패: ${insErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted?.id })
}
