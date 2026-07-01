import { cache } from 'react'
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

// PostgREST 1000행 우회 페이지네이션 (Plan 8/9 패턴)
// 통합 columns로 fetch — KPI/일별/상품 모두 파생 가능
// React cache로 같은 arg면 한 렌더 트리 내 1번만 실행 (성능 개선)
const fetchAllOrders = cache(async function fetchAllOrders(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  from: string,
  to: string
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000
  const all: Record<string, unknown>[] = []
  let offset = 0
  const columns = 'id, date, total_amount, is_cancelled, is_new'
  while (true) {
    let q = supabase
      .from('orders')
      .select(columns)
      .eq('brand_id', brandId)
      .gte('date', from)
      .lte('date', to)
    if (mall !== 'all') q = q.eq('mall_type', mall)
    const { data, error } = await q.range(offset, offset + PAGE - 1)
    if (error) throw new Error(`orders 조회 실패: ${error.message}`)
    const chunk = (data ?? []) as unknown as Record<string, unknown>[]
    all.push(...chunk)
    if (chunk.length < PAGE) break
    offset += PAGE
    if (offset > 200000) break
  }
  return all
})

export async function getMallList(
  supabase: SupabaseClient,
  brandId: string
): Promise<string[]> {
  const PAGE = 1000
  const set = new Set<string>()
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('mall_type')
      .eq('brand_id', brandId)
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`mall list 조회 실패: ${error.message}`)
    const chunk = (data ?? []) as { mall_type?: string }[]
    for (const r of chunk) {
      if (r.mall_type) set.add(r.mall_type)
    }
    if (chunk.length < PAGE) break
    offset += PAGE
    if (offset > 200000) break
  }
  return Array.from(set).sort()
}

export async function getOrdersKpis(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<OrderKpis> {
  const rows = await fetchAllOrders(supabase, brandId, mall, range.from, range.to)
  let totalRevenue = 0
  let orderCount = 0
  let refundAmount = 0
  let newCount = 0
  for (const r of rows) {
    const amount = toNum(r.total_amount as number | string | null)
    const cancelled = r.is_cancelled === true
    if (cancelled) {
      refundAmount += amount
    } else {
      totalRevenue += amount
      orderCount += 1
      if (r.is_new === true) newCount += 1
    }
  }
  const finalRevenue = totalRevenue - refundAmount
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : null
  const newOrderRate = orderCount > 0 ? (newCount / orderCount) * 100 : null

  // 방문자 (visitors 테이블에서 mall_type + range) — mall='all' 시 null
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
      visits = vRows.reduce((s, r) => s + toNum((r as { unique_visits?: number }).unique_visits), 0)
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
  }
}

export async function getDailyOrders(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<DailyRow[]> {
  const rows = await fetchAllOrders(supabase, brandId, mall, range.from, range.to)
  const byDate = new Map<string, { revenue: number; count: number }>()
  for (const r of rows) {
    if (r.is_cancelled === true) continue
    const d = String(r.date)
    const cur = byDate.get(d) ?? { revenue: 0, count: 0 }
    cur.revenue += toNum(r.total_amount as number | string | null)
    cur.count += 1
    byDate.set(d, cur)
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orderCount: v.count,
      avgOrderValue: v.count > 0 ? v.revenue / v.count : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getProductRanking(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<ProductRow[]> {
  // orders에서 브랜드 + 기간 + mall 필터로 order.id 목록 확보 후 order_items 조회
  const orderRows = await fetchAllOrders(supabase, brandId, mall, range.from, range.to)
  const orderIds = orderRows
    .filter((r) => r.is_cancelled !== true)
    .map((r) => r.id as string)
  if (orderIds.length === 0) return []

  const PAGE = 1000
  const all: { product_name: string; qty: number; amount: number }[] = []
  for (let i = 0; i < orderIds.length; i += PAGE) {
    const batch = orderIds.slice(i, i + PAGE)
    const { data, error } = await supabase
      .from('order_items')
      .select('product_name, qty, amount')
      .in('order_id', batch)
      .limit(100000)
    if (error) throw new Error(`order_items 조회 실패: ${error.message}`)
    for (const r of (data ?? []) as {
      product_name?: string
      qty?: number
      amount?: number | string
    }[]) {
      all.push({
        product_name: r.product_name ?? '상품',
        qty: toNum(r.qty ?? 0),
        amount: toNum(r.amount ?? 0),
      })
    }
  }

  const byName = new Map<string, { qty: number; amount: number }>()
  for (const it of all) {
    const cur = byName.get(it.product_name) ?? { qty: 0, amount: 0 }
    cur.qty += it.qty
    cur.amount += it.amount
    byName.set(it.product_name, cur)
  }
  const totalAmount = Array.from(byName.values()).reduce((s, v) => s + v.amount, 0)
  return Array.from(byName.entries())
    .map(([product_name, v]) => ({
      product_name,
      qty: v.qty,
      amount: v.amount,
      share: totalAmount > 0 ? (v.amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
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
  // 최근 metadata.inflows 최신 1행에서 가져옴 (매일 upsert로 덮어써지므로 range 마지막날 사용)
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
