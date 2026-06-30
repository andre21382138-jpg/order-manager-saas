'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyRow } from '@/lib/queries/ad-stats'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function ctr(r: DailyRow): string {
  return r.impressions === 0 ? '—' : `${((r.clicks / r.impressions) * 100).toFixed(2)}%`
}

function cpc(r: DailyRow): string {
  return r.clicks === 0 ? '—' : `₩${Math.round(r.cost / r.clicks).toLocaleString('ko-KR')}`
}

export function DailyTable({ data, isLoading }: { data: DailyRow[]; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📅 일별 광고 성과</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">날짜</th>
                <th className="py-2 pr-4 text-right">광고비</th>
                <th className="py-2 pr-4 text-right">노출</th>
                <th className="py-2 pr-4 text-right">클릭</th>
                <th className="py-2 pr-4 text-right">CTR</th>
                <th className="py-2 pr-4 text-right">CPC</th>
                <th className="py-2 pr-4 text-right">전환매출</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted-foreground">
                    로딩 중...
                  </td>
                </tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {data.map((r) => (
                <tr key={r.date} className="border-b">
                  <td className="py-2 pr-4">{r.date}</td>
                  <td className="py-2 pr-4 text-right">₩{fmt(r.cost)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.impressions)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.clicks)}</td>
                  <td className="py-2 pr-4 text-right">{ctr(r)}</td>
                  <td className="py-2 pr-4 text-right">{cpc(r)}</td>
                  <td className="py-2 pr-4 text-right">₩{fmt(r.conversion_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
