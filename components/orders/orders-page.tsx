import { MallTabs } from './mall-tabs'
import { DateRangeFilter } from './date-range-filter'
import { OrdersKpiCards } from './orders-kpi-cards'
import { DailyOrdersTable } from './daily-orders-table'
import { ProductRankingTable } from './product-ranking-table'
import { VisitorStatsCard } from './visitor-stats-card'
import { TrafficSourcesTable } from './traffic-sources-table'
import type {
  DateRange,
  OrderKpis,
  DailyRow,
  ProductRow,
  VisitorRow,
  TrafficRow,
} from '@/lib/queries/orders'

type Props = {
  brand: { id: string; name: string }
  malls: string[]
  mall: string
  range: DateRange
  kpis: OrderKpis
  daily: DailyRow[]
  products: ProductRow[]
  visitors: VisitorRow
  traffic: TrafficRow[]
  hasVisitors: boolean
  hasNewData: boolean
}

export function OrdersPage({
  brand,
  malls,
  mall,
  range,
  kpis,
  daily,
  products,
  visitors,
  traffic,
  hasVisitors,
  hasNewData,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{brand.name} — 매출 분석</h1>
        <DateRangeFilter brandId={brand.id} mall={mall} value={range} />
      </div>

      <MallTabs brandId={brand.id} malls={malls} activeMall={mall} range={range} />

      {malls.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          아직 쇼핑몰이 등록되지 않았습니다. 매체 연결에서 카페24 또는 스마트스토어를 등록하세요.
        </div>
      ) : (
        <>
          <OrdersKpiCards data={kpis} showVisits={hasVisitors} showNew={hasNewData} />
          <DailyOrdersTable data={daily} />
          <ProductRankingTable data={products} />
          {hasVisitors && (
            <div className="grid gap-4 md:grid-cols-2">
              <VisitorStatsCard data={visitors} />
              <TrafficSourcesTable data={traffic} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
