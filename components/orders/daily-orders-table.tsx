import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyRow } from '@/lib/queries/orders'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function DailyOrdersTable({ data }: { data: DailyRow[] }) {
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
                <th className="py-2 pr-4 text-right">객단가</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {data.map((r) => (
                <tr key={r.date} className="border-b">
                  <td className="py-2 pr-4">{r.date}</td>
                  <td className="py-2 pr-4 text-right">{fmtWon(r.revenue)}</td>
                  <td className="py-2 pr-4 text-right">
                    {r.orderCount.toLocaleString('ko-KR')}건
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {r.avgOrderValue === null ? '—' : fmtWon(r.avgOrderValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
