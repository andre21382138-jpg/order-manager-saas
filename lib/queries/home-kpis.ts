import type { SupabaseClient } from '@supabase/supabase-js'

export type HomeKpis = {
  todayRevenue: number
  todayOrderCount: number
  monthRevenue: number
  avgOrderValue: number
  todayAdCost: number
  monthAdCost: number
  todayRoas: number | null
  activeCampaignCount: number
  asOf: string // KST datetime label
}

export type DailyRevenuePoint = { date: string; revenue: number }
export type MallSharePoint = { mall_type: string; revenue: number; share: number }

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function firstOfMonthKst(): string {
  const now = kstNow()
  return ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
}

function todayKst(): string {
  return ymd(kstNow())
}

function yesterdayKst(): string {
  return ymd(new Date(kstNow().getTime() - 86400000))
}

function daysAgoKst(n: number): string {
  return ymd(new Date(kstNow().getTime() - n * 86400000))
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function nowKstLabel(): string {
  const n = kstNow()
  const y = n.getUTCFullYear()
  const m = String(n.getUTCMonth() + 1).padStart(2, '0')
  const d = String(n.getUTCDate()).padStart(2, '0')
  const hh = String(n.getUTCHours()).padStart(2, '0')
  const mm = String(n.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export async function getHomeKpis(
  supabase: SupabaseClient,
  brandId: string
): Promise<HomeKpis> {
  const today = todayKst()
  const firstOfMonth = firstOfMonthKst()

  // 1. 오늘 매출 + 주문 건수
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('brand_id', brandId)
    .eq('is_cancelled', false)
    .eq('date', today)
    .limit(100000)

  const todayRevenue = (todayOrders ?? []).reduce(
    (sum, r) => sum + toNum(r.total_amount),
    0
  )
  const todayOrderCount = todayOrders?.length ?? 0

  // 2. 이번달 누적 매출 + 평균 주문가
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('brand_id', brandId)
    .eq('is_cancelled', false)
    .gte('date', firstOfMonth)
    .limit(100000)

  const monthRevenue = (monthOrders ?? []).reduce(
    (sum, r) => sum + toNum(r.total_amount),
    0
  )
  const monthOrderCount = monthOrders?.length ?? 0
  const avgOrderValue = monthOrderCount > 0 ? monthRevenue / monthOrderCount : 0

  // 3. 오늘 광고비 (ad_stats JOIN ad_units level=campaign)
  const { data: todayAd } = await supabase
    .from('ad_stats')
    .select('cost, ad_units!inner(level)')
    .eq('brand_id', brandId)
    .eq('date', today)
    .limit(100000)

  const todayAdCost = (todayAd ?? [])
    .filter((r) => {
      const u = r.ad_units as unknown as { level?: string } | { level?: string }[]
      const level = Array.isArray(u) ? u[0]?.level : u?.level
      return level === 'campaign'
    })
    .reduce((sum, r) => sum + toNum(r.cost), 0)

  // 4. 이번달 광고비
  const { data: monthAd } = await supabase
    .from('ad_stats')
    .select('cost, ad_units!inner(level)')
    .eq('brand_id', brandId)
    .gte('date', firstOfMonth)
    .limit(100000)

  const monthAdCost = (monthAd ?? [])
    .filter((r) => {
      const u = r.ad_units as unknown as { level?: string } | { level?: string }[]
      const level = Array.isArray(u) ? u[0]?.level : u?.level
      return level === 'campaign'
    })
    .reduce((sum, r) => sum + toNum(r.cost), 0)

  // 5. 오늘 ROAS (오늘 매출 / 오늘 광고비 × 100)
  const todayRoas = todayAdCost > 0 ? (todayRevenue / todayAdCost) * 100 : null

  // 6. 활성 캠페인
  const { count: activeCampaignCount } = await supabase
    .from('ad_units')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('channel', 'naver_ad')
    .eq('level', 'campaign')
    .eq('active', true)

  return {
    todayRevenue,
    todayOrderCount,
    monthRevenue,
    avgOrderValue,
    todayAdCost,
    monthAdCost,
    todayRoas,
    activeCampaignCount: activeCampaignCount ?? 0,
    asOf: nowKstLabel(),
  }
}

export async function getDailyRevenue7d(
  supabase: SupabaseClient,
  brandId: string
): Promise<DailyRevenuePoint[]> {
  const sevenDaysAgo = daysAgoKst(7)
  const yesterday = yesterdayKst()

  const { data } = await supabase
    .from('orders')
    .select('date, total_amount')
    .eq('brand_id', brandId)
    .eq('is_cancelled', false)
    .gte('date', sevenDaysAgo)
    .lte('date', yesterday)
    .limit(100000)

  const byDate = new Map<string, number>()
  for (const r of data ?? []) {
    const d = r.date as string
    byDate.set(d, (byDate.get(d) ?? 0) + toNum(r.total_amount))
  }

  return Array.from(byDate.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getMallShare30d(
  supabase: SupabaseClient,
  brandId: string
): Promise<MallSharePoint[]> {
  const thirtyDaysAgo = daysAgoKst(30)
  const yesterday = yesterdayKst()

  const { data } = await supabase
    .from('orders')
    .select('mall_type, total_amount')
    .eq('brand_id', brandId)
    .eq('is_cancelled', false)
    .gte('date', thirtyDaysAgo)
    .lte('date', yesterday)
    .limit(100000)

  const byMall = new Map<string, number>()
  for (const r of data ?? []) {
    const m = String(r.mall_type ?? '미분류')
    byMall.set(m, (byMall.get(m) ?? 0) + toNum(r.total_amount))
  }

  const total = Array.from(byMall.values()).reduce((a, b) => a + b, 0)

  return Array.from(byMall.entries())
    .map(([mall_type, revenue]) => ({
      mall_type,
      revenue,
      share: total > 0 ? (revenue / total) * 100 : 0,
    }))
    .sort((a, b) => b.share - a.share)
}
