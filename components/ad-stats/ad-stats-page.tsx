'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  getAllAdStatsRows,
  computeKpis,
  computeDaily,
  computeByType,
  computeCampaigns,
  computeKeywords,
  type DateRange,
} from '@/lib/queries/ad-stats'
import { DateRangeFilter, defaultRange } from './date-range-filter'
import { AdKpiCards } from './ad-kpi-cards'
import { DailyTable } from './daily-table'
import { CampaignTypeTable } from './campaign-type-table'
import { CampaignTable } from './campaign-table'
import { KeywordTable } from './keyword-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { TrendChartModal } from './trend-chart-modal'
import { ProductMappingModal } from './product-mapping-modal'

type TrendUnit = { id: string; name: string }
type MapUnit = { id: string; name: string }

export function AdStatsPage({
  brand,
  hasCredential,
}: {
  brand: { id: string; name: string }
  hasCredential: boolean
}) {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [trendUnit, setTrendUnit] = useState<TrendUnit | null>(null)
  const [mapUnit, setMapUnit] = useState<MapUnit | null>(null)
  const supabase = createBrowserClient()

  // 원본 rows를 한 번만 fetch하고 5개 view는 useMemo로 파생 (기존엔 SWR 5개가 각각 fetch → 5x 부하)
  const rows = useSWR(
    hasCredential ? ['ad-stats-rows', brand.id, range.from, range.to] : null,
    () => getAllAdStatsRows(supabase, brand.id, range)
  )
  const isLoading = rows.isLoading
  const raw = rows.data ?? []

  const kpisData = useMemo(() => computeKpis(raw), [raw])
  const dailyData = useMemo(() => computeDaily(raw), [raw])
  const byTypeData = useMemo(() => computeByType(raw), [raw])
  const campaignsData = useMemo(() => computeCampaigns(raw), [raw])
  const keywordsData = useMemo(() => computeKeywords(raw), [raw])

  if (!hasCredential) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">{brand.name} — 광고 분석</h1>
        <Card>
          <CardHeader>
            <CardTitle>광고 자격증명 미등록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              이 브랜드에 네이버광고 자격증명이 등록되어 있지 않습니다. 매체 연동 페이지에서 등록 후 다시 이용해 주세요.
            </p>
            <Link
              href={`/brands/${brand.id}/settings/connections`}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 h-8"
            >
              매체 연동으로 이동
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">{brand.name} — 광고 분석</h1>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <AdKpiCards data={kpisData} isLoading={isLoading} />

      <DailyTable data={dailyData} isLoading={isLoading} />
      <CampaignTypeTable data={byTypeData} isLoading={isLoading} />

      <CampaignTable
        data={campaignsData}
        isLoading={isLoading}
        onRowClick={(u) => setTrendUnit(u)}
        onMapClick={(u) => setMapUnit(u)}
      />

      <KeywordTable
        data={keywordsData}
        campaigns={campaignsData}
        isLoading={isLoading}
        onRowClick={(u) => setTrendUnit(u)}
      />

      {trendUnit && (
        <TrendChartModal
          brandId={brand.id}
          unit={trendUnit}
          range={range}
          onClose={() => setTrendUnit(null)}
        />
      )}

      {mapUnit && (
        <ProductMappingModal
          brandId={brand.id}
          unit={mapUnit}
          onClose={() => setMapUnit(null)}
        />
      )}
    </div>
  )
}
