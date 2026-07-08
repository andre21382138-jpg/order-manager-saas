import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DailyRow, VisitorDailyPoint } from '@/lib/queries/orders'

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'] as const

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function DailyOrdersTable({
  data,
  visitorsDaily = [],
}: {
  data: DailyRow[]
  visitorsDaily?: VisitorDailyPoint[]
}) {
  const visitsByDate = new Map(visitorsDaily.map((v) => [v.date, v.visits]))
  const hasVisitors = visitorsDaily.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📅 일별 매출</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">날짜</th>
                <th className="py-2 pr-4 text-right">매출</th>
                <th className="py-2 pr-4 text-right">주문 건수</th>
                {hasVisitors && <th className="py-2 pr-4 text-right">방문자수</th>}
                {hasVisitors && <th className="py-2 pr-4 text-right">구매 전환률</th>}
                <th className="py-2 pr-4 text-right">객단가</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={hasVisitors ? 6 : 4} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {data.map((r) => {
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
