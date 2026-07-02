import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ExcelRow = Record<string, string | number | undefined>

function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}
const AD_GROUP_ALIASES = ['광고그룹', '광고그룹명', 'adgroup', 'adgroupname', '그룹', '그룹명']
const CATEGORY_ALIASES = ['상품구분', '상품구분명', 'category', 'categoryname', '구분', '구분명']

function findKey(row: ExcelRow, aliases: string[]): string | null {
  const keys = Object.keys(row)
  const normalizedAliases = aliases.map(normalize)
  for (const k of keys) {
    if (normalizedAliases.includes(normalize(k))) return k
  }
  return null
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

  // 헤더 자동 감지: 첫 30행 스캔하여 광고그룹/상품구분이 있는 행을 헤더로 사용
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | undefined>>(
    wb.Sheets[sheetName],
    { header: 1, defval: '' }
  )
  if (matrix.length === 0) {
    return NextResponse.json({ error: '빈 시트' }, { status: 400 })
  }

  const scanLimit = Math.min(30, matrix.length)
  let headerRowIdx = -1
  let groupCol = -1
  let catCol = -1
  const normalizedGroupAliases = AD_GROUP_ALIASES.map(normalize)
  const normalizedCatAliases = CATEGORY_ALIASES.map(normalize)

  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    let gCol = -1
    let cCol = -1
    for (let j = 0; j < row.length; j++) {
      const v = String(row[j] ?? '').trim()
      if (!v) continue
      const n = normalize(v)
      if (gCol < 0 && normalizedGroupAliases.includes(n)) gCol = j
      if (cCol < 0 && normalizedCatAliases.includes(n)) cCol = j
    }
    if (gCol >= 0 && cCol >= 0) {
      headerRowIdx = i
      groupCol = gCol
      catCol = cCol
      break
    }
  }

  if (headerRowIdx < 0) {
    const firstFewRows = matrix.slice(0, Math.min(5, matrix.length))
      .map((r, i) => `[row ${i + 1}: ${(Array.isArray(r) ? r.slice(0, 5) : []).join(' | ')}]`)
      .join('\n')
    return NextResponse.json(
      {
        error: `필수 컬럼(광고그룹, 상품구분)을 찾지 못했습니다. 첫 30행 내에서 헤더 미발견. 상단 5행 미리보기:\n${firstFewRows}`,
      },
      { status: 400 }
    )
  }

  // 헤더 감지 후 rowsRaw 재구성
  const rowsRaw: Array<Record<string, string | number | undefined>> = []
  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    rowsRaw.push({
      광고그룹: String(row[groupCol] ?? ''),
      상품구분: String(row[catCol] ?? ''),
    })
  }
  const groupKey = '광고그룹'
  const catKey = '상품구분'

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
    const groupName = String(r[groupKey] ?? '').trim()
    const catName = String(r[catKey] ?? '').trim()
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
