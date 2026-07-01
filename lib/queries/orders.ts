import type { SupabaseClient } from '@supabase/supabase-js'

export type DateRange = { from: string; to: string }

export type OrderKpis = {
  totalRevenue: number
  orderCount: number
  finalRevenue: number
  refundAmount: number
  avgOrderValue: number | null
  visits: number | null
  conversionRate: number | null
  newOrderRate: number | null
  memberCount: number
  guestCount: number
  memberNewCount: number
  memberRepeatCount: number
}

export type DailyRow = {
  date: string
  revenue: number
  orderCount: number
  avgOrderValue: number | null
}

export type ProductRow = {
  product_name: string
  qty: number
  amount: number
  share: number
}

export type VisitorDailyPoint = { date: string; visits: number }
export type VisitorRow = {
  totalVisits: number
  uniqueVisits: number
  daily: VisitorDailyPoint[]
}

export type TrafficRow = {
  domain: string
  visits: number
  share: number
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

export async function getMallList(
  supabase: SupabaseClient,
  brandId: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_mall_list', { p_brand_id: brandId })
  if (error) throw new Error(`mall list 조회 실패: ${error.message}`)
  return (data ?? []).map((r: { mall_type: string }) => r.mall_type)
}

export async function getOrdersKpis(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<OrderKpis> {
  const { data, error } = await supabase.rpc('get_orders_kpis', {
    p_brand_id: brandId,
    p_mall: mall,
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(`orders KPI 조회 실패: ${error.message}`)
  const row = (data ?? [])[0] ?? {
    total_revenue: 0,
    order_count: 0,
    refund_amount: 0,
    new_count: 0,
    member_count: 0,
    guest_count: 0,
    member_new_count: 0,
    member_repeat_count: 0,
  }
  const totalRevenue = toNum(row.total_revenue)
  const orderCount = Number(row.order_count ?? 0)
  const refundAmount = toNum(row.refund_amount)
  const newCount = Number(row.new_count ?? 0)
  const memberCount = Number(row.member_count ?? 0)
  const guestCount = Number(row.guest_count ?? 0)
  const memberNewCount = Number(row.member_new_count ?? 0)
  const memberRepeatCount = Number(row.member_repeat_count ?? 0)
  const finalRevenue = totalRevenue - refundAmount
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : null
  const newOrderRate = orderCount > 0 ? (newCount / orderCount) * 100 : null

  // 방문자 (mall !== 'all' 일 때만)
  let visits: number | null = null
  let conversionRate: number | null = null
  if (mall !== 'all') {
    const { data: vRows, error: vErr } = await supabase
      .from('visitors')
      .select('unique_visits')
      .eq('brand_id', brandId)
      .eq('mall_type', mall)
      .gte('date', range.from)
      .lte('date', range.to)
      .limit(10000)
    if (!vErr && vRows && vRows.length > 0) {
      visits = vRows.reduce(
        (s: number, r) => s + toNum((r as { unique_visits?: number }).unique_visits),
        0
      )
      conversionRate = visits > 0 ? (orderCount / visits) * 100 : null
    }
  }

  return {
    totalRevenue,
    orderCount,
    finalRevenue,
    refundAmount,
    avgOrderValue,
    visits,
    conversionRate,
    newOrderRate,
    memberCount,
    guestCount,
    memberNewCount,
    memberRepeatCount,
  }
}

export async function getDailyOrders(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<DailyRow[]> {
  const { data, error } = await supabase.rpc('get_daily_orders', {
    p_brand_id: brandId,
    p_mall: mall,
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(`일별 매출 조회 실패: ${error.message}`)
  return (data ?? []).map((r: { date: string; revenue: number | string; order_count: number }) => {
    const revenue = toNum(r.revenue)
    const count = Number(r.order_count ?? 0)
    return {
      date: String(r.date),
      revenue,
      orderCount: count,
      avgOrderValue: count > 0 ? revenue / count : null,
    }
  })
}

export async function getProductRanking(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<ProductRow[]> {
  const { data, error } = await supabase.rpc('get_product_ranking', {
    p_brand_id: brandId,
    p_mall: mall,
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(`상품 순위 조회 실패: ${error.message}`)
  const rows = (data ?? []).map((r: { product_name: string; qty: number; amount: number | string }) => ({
    product_name: r.product_name ?? '상품',
    qty: Number(r.qty ?? 0),
    amount: toNum(r.amount),
  }))
  const total = rows.reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  return rows.map((r: { product_name: string; qty: number; amount: number }) => ({
    ...r,
    share: total > 0 ? (r.amount / total) * 100 : 0,
  }))
}

export async function getVisitors(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<VisitorRow> {
  if (mall === 'all') return { totalVisits: 0, uniqueVisits: 0, daily: [] }
  const { data } = await supabase
    .from('visitors')
    .select('date, total_visits, unique_visits')
    .eq('brand_id', brandId)
    .eq('mall_type', mall)
    .gte('date', range.from)
    .lte('date', range.to)
    .order('date', { ascending: true })
    .limit(10000)
  const rows = (data ?? []) as { date: string; total_visits?: number; unique_visits?: number }[]
  const totalVisits = rows.reduce((s, r) => s + toNum(r.total_visits), 0)
  const uniqueVisits = rows.reduce((s, r) => s + toNum(r.unique_visits), 0)
  const daily = rows.map((r) => ({ date: r.date, visits: toNum(r.unique_visits) }))
  return { totalVisits, uniqueVisits, daily }
}

export async function getTrafficSources(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<TrafficRow[]> {
  if (mall === 'all') return []
  const { data } = await supabase
    .from('visitors')
    .select('metadata')
    .eq('brand_id', brandId)
    .eq('mall_type', mall)
    .lte('date', range.to)
    .order('date', { ascending: false })
    .limit(1)
  const row = (data ?? [])[0] as { metadata?: { inflows?: Array<Record<string, unknown>> } } | undefined
  const inflows = row?.metadata?.inflows ?? []
  const parsed = inflows.map((it) => ({
    domain: String(it.domain ?? it.host ?? it.name ?? '알 수 없음'),
    visits: toNum((it.visit_count ?? it.visits ?? it.count) as number | string | null),
  }))
  const total = parsed.reduce((s, r) => s + r.visits, 0)
  return parsed
    .map((r) => ({ ...r, share: total > 0 ? (r.visits / total) * 100 : 0 }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10)
}
