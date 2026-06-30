import type { SupabaseClient } from '@supabase/supabase-js'

export type HomeKpis = {
  todayRevenue: number
  todayOrderCount: number
  monthRevenue: number
  avgOrderValue: number
  yesterdayAdCost: number
  thirtyDayAdCost: number
  sevenDayRoas: number | null
  activeCampaignCount: number
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

export async function getHomeKpis(
  supabase: SupabaseClient,
  brandId: string
): Promise<HomeKpis> {
  const today = todayKst()
  const yesterday = yesterdayKst()
  const firstOfMonth = firstOfMonthKst()
  const sevenDaysAgo = daysAgoKst(7)
  const thirtyDaysAgo = daysAgoKst(30)

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

  // 3. 어제 광고비 (ad_stats JOIN ad_units level=campaign)
  const { data: yesterdayAd } = await supabase
    .from('ad_stats')
    .select('cost, ad_units!inner(level)')
    .eq('brand_id', brandId)
    .eq('date', yesterday)
    .limit(100000)

  const yesterdayAdCost = (yesterdayAd ?? [])
    .filter((r) => {
      const u = r.ad_units as unknown as { level?: string } | { level?: string }[]
      const level = Array.isArray(u) ? u[0]?.level : u?.level
      return level === 'campaign'
    })
    .reduce((sum, r) => sum + toNum(r.cost), 0)

  // 4. 30일 광고비
  const { data: thirtyDayAd } = await supabase
    .from('ad_stats')
    .select('cost, ad_units!inner(level)')
    .eq('brand_id', brandId)
    .gte('date', thirtyDaysAgo)
    .limit(100000)

  const thirtyDayAdCost = (thirtyDayAd ?? [])
    .filter((r) => {
      const u = r.ad_units as unknown as { level?: string } | { level?: string }[]
      const level = Array.isArray(u) ? u[0]?.level : u?.level
      return level === 'campaign'
    })
    .reduce((sum, r) => sum + toNum(r.cost), 0)

  // 5. 7일 ROAS (7일 매출 / 7일 광고비 × 100)
  const { data: sevenDayOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('brand_id', brandId)
    .eq('is_cancelled', false)
    .gte('date', sevenDaysAgo)
    .limit(100000)

  const sevenDayRevenue = (sevenDayOrders ?? []).reduce(
    (sum, r) => sum + toNum(r.total_amount),
    0
  )

  const { data: sevenDayAd } = await supabase
    .from('ad_stats')
    .select('cost, ad_units!inner(level)')
    .eq('brand_id', brandId)
    .gte('date', sevenDaysAgo)
    .limit(100000)

  const sevenDayAdCost = (sevenDayAd ?? [])
    .filter((r) => {
      const u = r.ad_units as unknown as { level?: string } | { level?: string }[]
      const level = Array.isArray(u) ? u[0]?.level : u?.level
      return level === 'campaign'
    })
    .reduce((sum, r) => sum + toNum(r.cost), 0)

  const sevenDayRoas =
    sevenDayAdCost > 0 ? (sevenDayRevenue / sevenDayAdCost) * 100 : null

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
    yesterdayAdCost,
    thirtyDayAdCost,
    sevenDayRoas,
    activeCampaignCount: activeCampaignCount ?? 0,
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
