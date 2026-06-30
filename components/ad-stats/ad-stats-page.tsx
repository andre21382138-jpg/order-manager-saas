'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  getKpis,
  type DateRange,
} from '@/lib/queries/ad-stats'
import { DateRangeFilter, defaultRange } from './date-range-filter'
import { AdKpiCards } from './ad-kpi-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type TrendUnit = { id: string; name: string }

export function AdStatsPage({
  brand,
  hasCredential,
}: {
  brand: { id: string; name: string }
  hasCredential: boolean
}) {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [, setTrendUnit] = useState<TrendUnit | null>(null) // Task 8에서 사용
  const supabase = createBrowserClient()

  const kpis = useSWR(
    hasCredential ? ['kpis', brand.id, range.from, range.to] : null,
    () => getKpis(supabase, brand.id, range)
  )

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

      <AdKpiCards data={kpis.data} isLoading={kpis.isLoading} />

      {/* Task 5/6/7 가 채움: DailyTable, CampaignTypeTable, CampaignTable, KeywordTable */}
      {/* Task 8: TrendChartModal */}

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          이후 일별 / 광고영역 / 캠페인 / 키워드 테이블 + 트렌드 모달 (Task 5~8)
        </CardContent>
      </Card>
    </div>
  )
}
