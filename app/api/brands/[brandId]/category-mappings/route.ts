import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
