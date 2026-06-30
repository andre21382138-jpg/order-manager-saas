import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = {
  date: string
  mall_type: string
  total_amount: number | string | null
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

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

function yesterdayKst(): string {
  return ymd(new Date(kstNow().getTime() - 86400000))
}

function daysAgoKst(n: number): string {
  return ymd(new Date(kstNow().getTime() - n * 86400000))
}

async function fetchOrders(
  supabase: SupabaseClient,
  brandId: string,
  from: string,
  to: string
): Promise<Row[]> {
  const PAGE = 1000
  const all: Row[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('date, mall_type, total_amount')
      .eq('brand_id', brandId)
      .eq('is_cancelled', false)
      .gte('date', from)
      .lte('date', to)
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`orders 조회 실패: ${error.message}`)
    const chunk = (data ?? []) as Row[]
    all.push(...chunk)
    if (chunk.length < PAGE) break
    offset += PAGE
    if (offset > 200000) break
  }
  return all
}

function fmt(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export default async function BrandOrdersPage({
  params,
}: {
  params: Promise<{ brandId: string }>
}) {
  const { brandId } = await params
  const supabase = await createServerClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()
  if (!brand) notFound()

  const monthFrom = firstOfMonthKst()
  const yesterday = yesterdayKst()
  const sevenAgo = daysAgoKst(7)

  const monthRows = await fetchOrders(supabase, brandId, monthFrom, yesterday)
  const sevenRows = await fetchOrders(supabase, brandId, sevenAgo, yesterday)

  // 쇼핑몰별 이번달 매출/주문 건수
  const byMall = new Map<string, { revenue: number; count: number }>()
  for (const r of monthRows) {
    const m = String(r.mall_type ?? '미분류')
    const cur = byMall.get(m) ?? { revenue: 0, count: 0 }
    cur.revenue += toNum(r.total_amount)
    cur.count += 1
    byMall.set(m, cur)
  }
  const mallRows = Array.from(byMall.entries())
    .map(([mall_type, v]) => ({ mall_type, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = mallRows.reduce((s, r) => s + r.revenue, 0)
  const totalCount = mallRows.reduce((s, r) => s + r.count, 0)

  // 7일 일별 × 매체별 pivot
  const dayMallMap = new Map<string, Map<string, number>>() // date → mall → revenue
  const mallSet = new Set<string>()
  for (const r of sevenRows) {
    const date = String(r.date)
    const mall = String(r.mall_type ?? '미분류')
    mallSet.add(mall)
    if (!dayMallMap.has(date)) dayMallMap.set(date, new Map())
    const m = dayMallMap.get(date)!
    m.set(mall, (m.get(mall) ?? 0) + toNum(r.total_amount))
  }
  const allMalls = Array.from(mallSet).sort()
  const allDates = Array.from(dayMallMap.keys()).sort()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{brand.name} — 매출 분석</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🛒 쇼핑몰별 매출 (이번달 누적)</CardTitle>
        </CardHeader>
        <CardContent>
          {mallRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">데이터 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">쇼핑몰</th>
                    <th className="py-2 pr-4 text-right">매출</th>
                    <th className="py-2 pr-4 text-right">주문 건수</th>
                    <th className="py-2 pr-4 text-right">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {mallRows.map((r) => (
                    <tr key={r.mall_type} className="border-b">
                      <td className="py-2 pr-4 font-medium">{r.mall_type}</td>
                      <td className="py-2 pr-4 text-right">{fmt(r.revenue)}</td>
                      <td className="py-2 pr-4 text-right">{r.count.toLocaleString('ko-KR')}건</td>
                      <td className="py-2 pr-4 text-right">
                        {totalRevenue === 0 ? '—' : `${((r.revenue / totalRevenue) * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 pr-4">합계</td>
                    <td className="py-2 pr-4 text-right">{fmt(totalRevenue)}</td>
                    <td className="py-2 pr-4 text-right">{totalCount.toLocaleString('ko-KR')}건</td>
                    <td className="py-2 pr-4 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📅 일별 × 쇼핑몰 매출 (최근 7일)</CardTitle>
        </CardHeader>
        <CardContent>
          {allDates.length === 0 ? (
            <p className="text-sm text-muted-foreground">데이터 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">날짜</th>
                    {allMalls.map((m) => (
                      <th key={m} className="py-2 pr-4 text-right">{m}</th>
                    ))}
                    <th className="py-2 pr-4 text-right">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {allDates.map((date) => {
                    const map = dayMallMap.get(date)!
                    const dayTotal = Array.from(map.values()).reduce((a, b) => a + b, 0)
                    return (
                      <tr key={date} className="border-b">
                        <td className="py-2 pr-4">{date}</td>
                        {allMalls.map((m) => (
                          <td key={m} className="py-2 pr-4 text-right">{fmt(map.get(m) ?? 0)}</td>
                        ))}
                        <td className="py-2 pr-4 text-right font-semibold">{fmt(dayTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        매출 분석 본격 페이지(필터/정렬/상품별/주문 list)는 후속 Plan 10에서 제공됩니다.
      </p>
    </div>
  )
}
