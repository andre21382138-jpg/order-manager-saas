import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ExcelRow = {
  상품구분?: string
  상품코드?: string | number
  상품명?: string | number
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
  if (!('상품구분' in first) || !('상품코드' in first)) {
    return NextResponse.json(
      { error: '필수 컬럼(상품구분, 상품코드) 누락' },
      { status: 400 }
    )
  }

  // Excel row → (product_no → { category, product_name })
  // last-write-wins + 충돌 감지 (같은 상품코드에 다른 상품구분이 지정된 경우)
  const noToCategories = new Map<string, string[]>()
  const finalMap = new Map<string, { category: string; productName: string | null }>()
  const categorySet = new Set<string>()
  let skippedNoCode = 0

  for (const r of rowsRaw) {
    const category = String(r.상품구분 ?? '').trim()
    const productNo = String(r.상품코드 ?? '').trim()
    const productName = r.상품명 != null && String(r.상품명).trim() !== ''
      ? String(r.상품명).trim()
      : null
    if (!category) continue
    if (!productNo) {
      skippedNoCode++
      continue
    }
    categorySet.add(category)
    const arr = noToCategories.get(productNo) ?? []
    if (!arr.includes(category)) arr.push(category)
    noToCategories.set(productNo, arr)
    finalMap.set(productNo, { category, productName }) // last-write-wins
  }

  const conflicts = Array.from(noToCategories.entries())
    .filter(([, cats]) => cats.length > 1)
    .map(([productNo, cats]) => {
      const chosen = finalMap.get(productNo)!.category
      return {
        productNo,
        chosenCategory: chosen,
        otherCategories: cats.filter((c) => c !== chosen),
      }
    })

  const admin = createAdminClient()

  // 누적 저장 (병합): 기존 categories/mappings 유지, 새 것 upsert.
  // - 같은 카테고리명은 재사용 (INSERT ... ON CONFLICT DO NOTHING → 기존 id 재조회)
  // - 같은 상품코드는 카테고리 갱신 (UPSERT)
  // - Excel에 없는 기존 매핑(예: UI에서 수동 지정)은 보존

  // 1. 요청된 카테고리명 중 미존재 것만 insert
  const requestedNames = Array.from(categorySet)
  if (requestedNames.length > 0) {
    const { error: catInsErr } = await admin
      .from('product_categories')
      .upsert(
        requestedNames.map((name) => ({ brand_id: brandId, name })),
        { onConflict: 'brand_id,name', ignoreDuplicates: true }
      )
    if (catInsErr) {
      return NextResponse.json(
        { error: `카테고리 저장 실패: ${catInsErr.message}` },
        { status: 500 }
      )
    }
  }

  // 2. 카테고리 id 매핑 (기존 + 새로 추가한 것 모두 조회)
  const { data: allCats, error: catSelErr } = await admin
    .from('product_categories')
    .select('id, name')
    .eq('brand_id', brandId)
    .in('name', requestedNames.length > 0 ? requestedNames : [''])
  if (catSelErr) {
    return NextResponse.json(
      { error: `카테고리 조회 실패: ${catSelErr.message}` },
      { status: 500 }
    )
  }
  const catIdByName = new Map((allCats ?? []).map((c) => [c.name, c.id]))

  // 3. mappings upsert
  const mappingRows = Array.from(finalMap.entries()).map(([productNo, v]) => ({
    brand_id: brandId,
    category_id: catIdByName.get(v.category)!,
    product_no: productNo,
    product_name: v.productName,
  }))
  const CHUNK = 1000
  let upserted = 0
  for (let i = 0; i < mappingRows.length; i += CHUNK) {
    const batch = mappingRows.slice(i, i + CHUNK)
    const { error: mapErr } = await admin
      .from('product_category_mappings')
      .upsert(batch, { onConflict: 'brand_id,product_no' })
    if (mapErr) {
      return NextResponse.json(
        { error: `매핑 저장 실패 (batch ${i}): ${mapErr.message}` },
        { status: 500 }
      )
    }
    upserted += batch.length
  }

  return NextResponse.json({
    ok: true,
    categoriesCount: requestedNames.length,
    mappingsCount: upserted,
    conflicts,
    skippedNoCode,
    elapsedMs: Date.now() - started,
  })
}
