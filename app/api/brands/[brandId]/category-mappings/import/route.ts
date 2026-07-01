import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ExcelRow = {
  상품구분?: string
  상품코드?: string | number
  상품명?: string
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ brandId: string }> }
) {
  const started = Date.now()
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

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return NextResponse.json({ error: '시트가 없습니다' }, { status: 400 })
  const rowsRaw = XLSX.utils.sheet_to_json<ExcelRow>(wb.Sheets[sheetName], { defval: '' })

  if (rowsRaw.length === 0) {
    return NextResponse.json({ error: '빈 시트' }, { status: 400 })
  }
  const first = rowsRaw[0]
  if (!('상품구분' in first) || !('상품명' in first)) {
    return NextResponse.json(
      { error: '필수 컬럼(상품구분, 상품명) 누락' },
      { status: 400 }
    )
  }

  // Excel row → (product_name → { category, product_no })
  // last-write-wins + 충돌 감지
  const nameToCategories = new Map<string, string[]>()
  const finalMap = new Map<string, { category: string; productNo: string | null }>()
  const categorySet = new Set<string>()

  for (const r of rowsRaw) {
    const category = String(r.상품구분 ?? '').trim()
    const name = String(r.상품명 ?? '').trim()
    const productNo = r.상품코드 != null && r.상품코드 !== ''
      ? String(r.상품코드).trim()
      : null
    if (!category || !name) continue
    categorySet.add(category)
    const arr = nameToCategories.get(name) ?? []
    if (!arr.includes(category)) arr.push(category)
    nameToCategories.set(name, arr)
    finalMap.set(name, { category, productNo }) // last-write-wins
  }

  const conflicts = Array.from(nameToCategories.entries())
    .filter(([, cats]) => cats.length > 1)
    .map(([productName, cats]) => {
      const chosen = finalMap.get(productName)!.category
      return {
        productName,
        chosenCategory: chosen,
        otherCategories: cats.filter((c) => c !== chosen),
      }
    })

  const admin = createAdminClient()

  // 전체 교체: 기존 categories 삭제 → CASCADE로 mappings + campaign_product_mappings 정리
  const { error: delErr } = await admin
    .from('product_categories')
    .delete()
    .eq('brand_id', brandId)
  if (delErr) {
    return NextResponse.json(
      { error: `기존 카테고리 삭제 실패: ${delErr.message}` },
      { status: 500 }
    )
  }

  // categories insert
  const categoryRows = Array.from(categorySet).map((name) => ({
    brand_id: brandId,
    name,
  }))
  const { data: insertedCats, error: catErr } = await admin
    .from('product_categories')
    .insert(categoryRows)
    .select('id, name')
  if (catErr || !insertedCats) {
    return NextResponse.json(
      { error: `카테고리 저장 실패: ${catErr?.message}` },
      { status: 500 }
    )
  }
  const catIdByName = new Map(insertedCats.map((c) => [c.name, c.id]))

  // mappings insert
  const mappingRows = Array.from(finalMap.entries()).map(([productName, v]) => ({
    brand_id: brandId,
    category_id: catIdByName.get(v.category)!,
    product_no: v.productNo,
    product_name: productName,
  }))
  const CHUNK = 1000
  let inserted = 0
  for (let i = 0; i < mappingRows.length; i += CHUNK) {
    const batch = mappingRows.slice(i, i + CHUNK)
    const { error: mapErr } = await admin
      .from('product_category_mappings')
      .insert(batch)
    if (mapErr) {
      return NextResponse.json(
        { error: `매핑 저장 실패 (batch ${i}): ${mapErr.message}` },
        { status: 500 }
      )
    }
    inserted += batch.length
  }

  return NextResponse.json({
    ok: true,
    categoriesCount: categoryRows.length,
    mappingsCount: inserted,
    conflicts,
    elapsedMs: Date.now() - started,
  })
}
