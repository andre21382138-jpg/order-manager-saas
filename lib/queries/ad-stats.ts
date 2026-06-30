import type { SupabaseClient } from '@supabase/supabase-js'

export type DateRange = { from: string; to: string }

export type Kpis = {
  cost: number
  impressions: number
  clicks: number
  conversions: number
  conversion_revenue: number
}

export type DailyRow = Kpis & { date: string }
export type ByTypeRow = Kpis & { type: string }
export type CampaignRow = Kpis & {
  ad_unit_id: string
  campaign_id: string
  campaign_name: string
  campaign_type: string
}
export type KeywordRow = Kpis & {
  ad_unit_id: string
  keyword_id: string
  keyword_name: string
  campaign_id: string
  campaign_name: string
  ad_group_name: string
}
export type TrendPoint = Kpis & { date: string }

const emptyKpis: Kpis = { cost: 0, impressions: 0, clicks: 0, conversions: 0, conversion_revenue: 0 }

function addKpis(a: Kpis, b: Kpis): Kpis {
  return {
    cost: a.cost + b.cost,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
    conversion_revenue: a.conversion_revenue + b.conversion_revenue,
  }
}

type RawStatsRow = {
  date: string
  impressions: number
  clicks: number
  cost: number | string
  conversions: number
  conversion_revenue: number | string
  ad_units: {
    id: string
    external_id: string
    external_name: string
    level: 'campaign' | 'keyword' | 'ad_group'
    parent_id: string | null
    metadata: Record<string, unknown> | null
  } | null
}

async function fetchAllRows(
  supabase: SupabaseClient,
  brandId: string,
  range: DateRange
): Promise<RawStatsRow[]> {
  const { data, error } = await supabase
    .from('ad_stats')
    .select(`
      date, impressions, clicks, cost, conversions, conversion_revenue,
      ad_units!inner ( id, external_id, external_name, level, parent_id, metadata )
    `)
    .eq('brand_id', brandId)
    .gte('date', range.from)
    .lte('date', range.to)
    .limit(100000)
  if (error) throw new Error(`ad_stats 조회 실패: ${error.message}`)
  return (data ?? []) as unknown as RawStatsRow[]
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function rowToKpis(r: RawStatsRow): Kpis {
  return {
    cost: toNum(r.cost),
    impressions: toNum(r.impressions),
    clicks: toNum(r.clicks),
    conversions: toNum(r.conversions),
    conversion_revenue: toNum(r.conversion_revenue),
  }
}

export async function getKpis(
  supabase: SupabaseClient,
  brandId: string,
  range: DateRange
): Promise<Kpis> {
  const rows = await fetchAllRows(supabase, brandId, range)
  // campaign 행만 합산 (keyword 행은 campaign 안에 포함되므로 중복 방지)
  return rows
    .filter((r) => r.ad_units?.level === 'campaign')
    .reduce((acc, r) => addKpis(acc, rowToKpis(r)), emptyKpis)
}

export async function getDaily(
  supabase: SupabaseClient,
  brandId: string,
  range: DateRange
): Promise<DailyRow[]> {
  const rows = await fetchAllRows(supabase, brandId, range)
  const byDate = new Map<string, Kpis>()
  for (const r of rows) {
    if (r.ad_units?.level !== 'campaign') continue
    const cur = byDate.get(r.date) ?? emptyKpis
    byDate.set(r.date, addKpis(cur, rowToKpis(r)))
  }
  return Array.from(byDate.entries())
    .map(([date, k]) => ({ date, ...k }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getByType(
  supabase: SupabaseClient,
  brandId: string,
  range: DateRange
): Promise<ByTypeRow[]> {
  const rows = await fetchAllRows(supabase, brandId, range)
  const byType = new Map<string, Kpis>()
  for (const r of rows) {
    if (r.ad_units?.level !== 'campaign') continue
    const type = String((r.ad_units?.metadata as { type?: string })?.type ?? 'unknown')
    const cur = byType.get(type) ?? emptyKpis
    byType.set(type, addKpis(cur, rowToKpis(r)))
  }
  return Array.from(byType.entries())
    .map(([type, k]) => ({ type, ...k }))
    .sort((a, b) => b.cost - a.cost)
}

export async function getCampaigns(
  supabase: SupabaseClient,
  brandId: string,
  range: DateRange
): Promise<CampaignRow[]> {
  const rows = await fetchAllRows(supabase, brandId, range)
  const byUnit = new Map<string, { meta: RawStatsRow; kpi: Kpis }>()
  for (const r of rows) {
    if (r.ad_units?.level !== 'campaign') continue
    const id = r.ad_units.id
    const cur = byUnit.get(id) ?? { meta: r, kpi: emptyKpis }
    byUnit.set(id, { meta: r, kpi: addKpis(cur.kpi, rowToKpis(r)) })
  }
  return Array.from(byUnit.entries())
    .map(([ad_unit_id, { meta, kpi }]) => ({
      ad_unit_id,
      campaign_id: meta.ad_units!.external_id,
      campaign_name: meta.ad_units!.external_name,
      campaign_type: String((meta.ad_units!.metadata as { type?: string })?.type ?? 'unknown'),
      ...kpi,
    }))
    .sort((a, b) => b.cost - a.cost)
}

export async function getKeywords(
  supabase: SupabaseClient,
  brandId: string,
  range: DateRange
): Promise<KeywordRow[]> {
  const rows = await fetchAllRows(supabase, brandId, range)
  // 캠페인 id→name 매핑 빌드 (parent_id로 lookup)
  const campaignsById = new Map<string, { external_id: string; external_name: string }>()
  for (const r of rows) {
    if (r.ad_units?.level === 'campaign') {
      campaignsById.set(r.ad_units.id, {
        external_id: r.ad_units.external_id,
        external_name: r.ad_units.external_name,
      })
    }
  }
  const byUnit = new Map<string, { meta: RawStatsRow; kpi: Kpis }>()
  for (const r of rows) {
    if (r.ad_units?.level !== 'keyword') continue
    const id = r.ad_units.id
    const cur = byUnit.get(id) ?? { meta: r, kpi: emptyKpis }
    byUnit.set(id, { meta: r, kpi: addKpis(cur.kpi, rowToKpis(r)) })
  }
  return Array.from(byUnit.entries())
    .map(([ad_unit_id, { meta, kpi }]) => {
      const parentDb = meta.ad_units!.parent_id
      const parent = parentDb ? campaignsById.get(parentDb) : undefined
      const m = (meta.ad_units!.metadata ?? {}) as { ad_group_id?: string; ad_group_name?: string }
      return {
        ad_unit_id,
        keyword_id: meta.ad_units!.external_id,
        keyword_name: meta.ad_units!.external_name,
        campaign_id: parent?.external_id ?? '',
        campaign_name: parent?.external_name ?? '',
        ad_group_name: m.ad_group_name ?? '',
        ...kpi,
      }
    })
    .sort((a, b) => b.cost - a.cost)
}

export async function getTrendByUnitId(
  supabase: SupabaseClient,
  unitId: string,
  range: DateRange
): Promise<TrendPoint[]> {
  const { data, error } = await supabase
    .from('ad_stats')
    .select('date, impressions, clicks, cost, conversions, conversion_revenue')
    .eq('ad_unit_id', unitId)
    .gte('date', range.from)
    .lte('date', range.to)
    .order('date', { ascending: true })
    .limit(10000)
  if (error) throw new Error(`trend 조회 실패: ${error.message}`)
  return (data ?? []).map((r) => ({
    date: r.date as string,
    cost: toNum(r.cost),
    impressions: toNum(r.impressions),
    clicks: toNum(r.clicks),
    conversions: toNum(r.conversions),
    conversion_revenue: toNum(r.conversion_revenue),
  }))
}
