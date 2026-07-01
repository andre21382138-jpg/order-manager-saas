import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { OrdersPage } from '@/components/orders/orders-page'
import {
  getMallList,
  getOrdersKpis,
  getDailyOrders,
  getProductRanking,
  getVisitors,
  getTrafficSources,
  type DateRange,
} from '@/lib/queries/orders'

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function defaultRange(): DateRange {
  const now = kstNow()
  const yesterday = new Date(now.getTime() - 86400000)
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  // 오늘이 1일이면 당월 = 오늘 하나뿐이라 데이터 부족 → 최근 30일 fallback
  if (firstOfMonth.getTime() >= yesterday.getTime()) {
    return {
      from: ymd(new Date(yesterday.getTime() - 29 * 86400000)),
      to: ymd(yesterday),
    }
  }
  return { from: ymd(firstOfMonth), to: ymd(yesterday) }
}

export default async function BrandOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ mall?: string; from?: string; to?: string }>
}) {
  const { brandId } = await params
  const sp = await searchParams

  const supabase = await createServerClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()
  if (!brand) notFound()

  // 쿼리 params 검증
  const dr = defaultRange()
  const range: DateRange = {
    from: sp.from ?? dr.from,
    to: sp.to ?? dr.to,
  }
  const malls = await getMallList(supabase, brandId)
  const mall = sp.mall && (sp.mall === 'all' || malls.includes(sp.mall)) ? sp.mall : 'all'

  const [kpis, daily, products, visitors, traffic] = await Promise.all([
    getOrdersKpis(supabase, brandId, mall, range),
    getDailyOrders(supabase, brandId, mall, range),
    getProductRanking(supabase, brandId, mall, range),
    getVisitors(supabase, brandId, mall, range),
    getTrafficSources(supabase, brandId, mall, range),
  ])

  const hasVisitors = mall !== 'all' && visitors.daily.length > 0
  // 신규/재구매는 자사몰(cafe24 회원) 데이터. 스마트스토어는 게스트 구매 다수라 무의미.
  // visitors 매칭 있는 cafe24 mall에만 표시.
  const hasNewData = hasVisitors && kpis.newOrderRate !== null

  return (
    <OrdersPage
      brand={brand}
      malls={malls}
      mall={mall}
      range={range}
      kpis={kpis}
      daily={daily}
      products={products}
      visitors={visitors}
      traffic={traffic}
      hasVisitors={hasVisitors}
      hasNewData={hasNewData}
    />
  )
}
