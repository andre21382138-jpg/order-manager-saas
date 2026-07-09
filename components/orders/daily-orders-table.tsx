'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  getDailyOrders,
  type DailyRow,
  type VisitorDailyPoint,
  type DateRange,
  type DailyRevenueInclusion,
} from '@/lib/queries/orders'

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'] as const

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
      <span>{label}</span>
    </label>
  )
}

export function DailyOrdersTable({
  data: initialData,
  visitorsDaily = [],
  brandId,
  mall,
  range,
}: {
  data: DailyRow[]
  visitorsDaily?: VisitorDailyPoint[]
  brandId: string
  mall: string
  range: DateRange
}) {
  const supabase = createBrowserClient()
  const [inclusion, setInclusion] = useState<DailyRevenueInclusion>({
    points: true,
    credits: true,
    naver: true,
  })
  const [applied, setApplied] = useState<DailyRevenueInclusion>(inclusion)

  useEffect(() => {
    setInclusion({ points: true, credits: true, naver: true })
    setApplied({ points: true, credits: true, naver: true })
  }, [brandId, mall, range.from, range.to])

  const isDefault =
    applied.points && applied.credits && applied.naver
  const { data: swrData } = useSWR(
    ['daily-orders', brandId, mall, range.from, range.to, applied.points, applied.credits, applied.naver],
    () => getDailyOrders(supabase, brandId, mall, range, applied),
    { fallbackData: isDefault ? initialData : undefined, revalidateOnFocus: false }
  )
  const rows = swrData ?? initialData

  const visitsByDate = new Map(visitorsDaily.map((v) => [v.date, v.visits]))
  const hasVisitors = visitorsDaily.length > 0
  const dirty =
    inclusion.points !== applied.points ||
    inclusion.credits !== applied.credits ||
    inclusion.naver !== applied.naver

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-base">📅 일별 매출</CardTitle>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="font-medium">매출 산정에 포함:</span>
          <Checkbox
            checked={inclusion.points}
            onChange={(v) => setInclusion((s) => ({ ...s, points: v }))}
            label="적립금"
          />
          <Checkbox
            checked={inclusion.credits}
            onChange={(v) => setInclusion((s) => ({ ...s, credits: v }))}
            label="예치금"
          />
          <Checkbox
            checked={inclusion.naver}
            onChange={(v) => setInclusion((s) => ({ ...s, naver: v }))}
            label="네이버포인트"
          />
          <Button
            type="button"
            size="sm"
            variant={dirty ? 'default' : 'outline'}
            onClick={() => setApplied(inclusion)}
          >
            조회
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">날짜</th>
                <th className="py-2 pr-4 text-right">매출</th>
                <th className="py-2 pr-4 text-right">주문 건수</th>
                {hasVisitors && <th className="py-2 pr-4 text-right">순방문자수</th>}
                {hasVisitors && <th className="py-2 pr-4 text-right">구매 전환률</th>}
                <th className="py-2 pr-4 text-right">객단가</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={hasVisitors ? 6 : 4} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const dow = dayOfWeek(r.date)
                const isWeekend = dow === 0 || dow === 6
                const visits = visitsByDate.get(r.date) ?? null
                const conv = visits !== null && visits > 0 ? (r.orderCount / visits) * 100 : null
                return (
                  <tr key={r.date} className="border-b">
                    <td className={cn('py-2 pr-4 tabular-nums', isWeekend && 'text-red-600')}>
                      {r.date} ({WEEKDAY_KR[dow]})
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtWon(r.revenue)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.orderCount.toLocaleString('ko-KR')}건
                    </td>
                    {hasVisitors && (
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {visits === null ? '—' : `${visits.toLocaleString('ko-KR')}명`}
                      </td>
                    )}
                    {hasVisitors && (
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {conv === null ? '—' : `${conv.toFixed(1)}%`}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.avgOrderValue === null ? '—' : fmtWon(r.avgOrderValue)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
