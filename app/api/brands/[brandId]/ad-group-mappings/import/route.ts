import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ExcelRow = {
  광고그룹?: string | number
  상품구분?: string | number
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
  if (!('광고그룹' in first) || !('상품구분' in first)) {
    return NextResponse.json(
      { error: '필수 컬럼(광고그룹, 상품구분) 누락' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // 카테고리 이름 → id 매핑 (로컬)
  const { data: cats, error: catErr } = await admin
    .from('product_categories')
    .select('id, name')
    .eq('brand_id', brandId)
  if (catErr) {
    return NextResponse.json({ error: `카테고리 조회 실패: ${catErr.message}` }, { status: 500 })
  }
  const catIdByName = new Map<string, string>()
  for (const c of cats ?? []) catIdByName.set(String(c.name), String(c.id))

  // 광고그룹 이름 → id (metadata 기반). 동명이인 있으면 첫 번째로 매핑 (last-write-wins)
  const { data: units, error: unitErr } = await admin
    .from('ad_units')
    .select('metadata')
    .eq('brand_id', brandId)
    .eq('level', 'keyword')
  if (unitErr) {
    return NextResponse.json({ error: `광고그룹 조회 실패: ${unitErr.message}` }, { status: 500 })
  }
  const adGroupIdByName = new Map<string, string>()
  const adGroupNameCounts = new Map<string, Set<string>>()
  for (const u of units ?? []) {
    const meta = (u.metadata ?? {}) as { ad_group_id?: string; ad_group_name?: string }
    const id = String(meta.ad_group_id ?? '').trim()
    const name = String(meta.ad_group_name ?? '').trim()
    if (!id || !name) continue
    if (!adGroupIdByName.has(name)) adGroupIdByName.set(name, id)
    const set = adGroupNameCounts.get(name) ?? new Set<string>()
    set.add(id)
    adGroupNameCounts.set(name, set)
  }

  const rows: { brand_id: string; ad_group_id: string; category_id: string }[] = []
  const errors: { row: number; message: string }[] = []
  const conflicts: { adGroupName: string; count: number }[] = []
  let skipped = 0

  for (let i = 0; i < rowsRaw.length; i++) {
    const r = rowsRaw[i]
    const groupName = String(r.광고그룹 ?? '').trim()
    const catName = String(r.상품구분 ?? '').trim()
    if (!groupName || !catName) {
      skipped++
      continue
    }
    const adGroupId = adGroupIdByName.get(groupName)
    const categoryId = catIdByName.get(catName)
    if (!adGroupId) {
      errors.push({ row: i + 2, message: `광고그룹 미발견: ${groupName}` })
      continue
    }
    if (!categoryId) {
      errors.push({ row: i + 2, message: `상품구분 미발견: ${catName}` })
      continue
    }
    const ids = adGroupNameCounts.get(groupName)
    if (ids && ids.size > 1) {
      conflicts.push({ adGroupName: groupName, count: ids.size })
    }
    rows.push({ brand_id: brandId, ad_group_id: adGroupId, category_id: categoryId })
  }

  let upserted = 0
  if (rows.length > 0) {
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK)
      const { error: mapErr } = await admin
        .from('ad_group_category_mappings')
        .upsert(batch, { onConflict: 'brand_id,ad_group_id' })
      if (mapErr) {
        return NextResponse.json({ error: `매핑 저장 실패: ${mapErr.message}` }, { status: 500 })
      }
      upserted += batch.length
    }
  }

  return NextResponse.json({
    ok: true,
    upserted,
    skipped,
    errors: errors.slice(0, 100),
    errorsMore: Math.max(0, errors.length - 100),
    conflicts,
    elapsedMs: Date.now() - started,
  })
}
