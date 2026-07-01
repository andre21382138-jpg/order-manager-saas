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
import { defaultRange } from '@/components/orders/date-range-filter'

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
  const hasNewData = kpis.newOrderRate !== null

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
