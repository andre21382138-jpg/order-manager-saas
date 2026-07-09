'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MallTabs } from './mall-tabs'
import { DateRangeFilter } from './date-range-filter'
import { OrdersKpiCards } from './orders-kpi-cards'
import { DailyOrdersTable } from './daily-orders-table'
import { ProductRankingTable } from './product-ranking-table'
import { VisitorStatsCard } from './visitor-stats-card'
import { TrafficSourcesTable } from './traffic-sources-table'
import { OrderLinesTab } from './order-lines-tab'
import { AllMallsOverview } from './all-malls-overview'
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
  prevRange: DateRange
  prevKpis: OrderKpis
  prevProducts: ProductRow[]
  prevVisitors: VisitorRow
  prevTraffic: TrafficRow[]
  perMallKpis: { mall: string; kpis: OrderKpis; prevKpis: OrderKpis }[]
}

type SubTab = 'dashboard' | 'lines'

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
  prevRange,
  prevKpis,
  prevProducts,
  prevVisitors,
  prevTraffic,
  perMallKpis,
}: Props) {
  const [tab, setTab] = useState<SubTab>('dashboard')
  const isAllMultimall = mall === 'all' && malls.length >= 2

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">매출조회</h1>
        <DateRangeFilter brandId={brand.id} mall={mall} value={range} />
      </div>

      <MallTabs brandId={brand.id} malls={malls} activeMall={mall} range={range} />

      {malls.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          아직 쇼핑몰이 등록되지 않았습니다. 매체 연결에서 카페24 또는 스마트스토어를 등록하세요.
        </div>
      ) : isAllMultimall ? (
        <AllMallsOverview
          kpis={kpis}
          prevKpis={prevKpis}
          prevRange={prevRange}
          perMallKpis={perMallKpis}
        />
      ) : (
        <>
          <div className="flex gap-1 border-b">
            {[
              { key: 'dashboard' as SubTab, label: '대시보드' },
              { key: 'lines' as SubTab, label: '주문조회' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'border-b-2 px-4 py-2 text-sm transition-colors',
                  tab === t.key
                    ? 'border-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'dashboard' ? (
            <div className="space-y-10 [&>section]:pb-2 [&>section]:shadow-[0_18px_12px_-14px_rgba(15,23,42,0.25)]">
              <section>
                <OrdersKpiCards
                  data={kpis}
                  showVisits={hasVisitors}
                  showNew={hasNewData}
                  prev={prevKpis}
                  prevRange={prevRange}
                />
              </section>
              <section>
                <DailyOrdersTable
                  data={daily}
                  visitorsDaily={visitors.daily}
                  brandId={brand.id}
                  mall={mall}
                  range={range}
                />
              </section>
              <section>
                <ProductRankingTable data={products} prev={prevProducts} />
              </section>
              {hasVisitors && (
                <section>
                  <div className="grid gap-4 md:grid-cols-2">
                    <VisitorStatsCard data={visitors} prev={prevVisitors} />
                    <TrafficSourcesTable data={traffic} prev={prevTraffic} />
                  </div>
                </section>
              )}
            </div>
          ) : (
            <OrderLinesTab brandId={brand.id} mall={mall} range={range} />
          )}
        </>
      )}
    </div>
  )
}
