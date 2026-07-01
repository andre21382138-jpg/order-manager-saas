import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TrafficRow } from '@/lib/queries/orders'

export function TrafficSourcesTable({ data }: { data: TrafficRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">🌐 유입경로 (Top 10)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">도메인</th>
                <th className="py-2 pr-4 text-right">방문 수</th>
                <th className="py-2 pr-4 text-right">비중</th>
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
              {data.map((r, i) => (
                <tr key={`${r.domain}-${i}`} className="border-b">
                  <td className="py-2 pr-4 font-medium">{i + 1}</td>
                  <td className="py-2 pr-4">{r.domain}</td>
                  <td className="py-2 pr-4 text-right">
                    {r.visits.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 pr-4 text-right">{r.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
