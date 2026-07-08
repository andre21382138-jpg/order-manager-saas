import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TrafficRow } from '@/lib/queries/orders'

export function TrafficSourcesTable({
  data,
  prev = [],
}: {
  data: TrafficRow[]
  prev?: TrafficRow[]
}) {
  const prevByDomain = new Map(prev.map((r) => [r.domain, r]))

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
                <th className="py-2 pr-4">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="min-w-[3.5rem] text-right">방문수</span>
                    <span className="min-w-[4rem] text-left text-xs">(전월)</span>
                  </div>
                </th>
                <th className="py-2 pr-4">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="min-w-[3.5rem] text-right">비중</span>
                    <span className="min-w-[3.5rem] text-left text-xs">(전월)</span>
                  </div>
                </th>
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
              {data.map((r, i) => {
                const p = prevByDomain.get(r.domain)
                const prevVisits = p ? p.visits.toLocaleString('ko-KR') : '(-)'
                const prevShare = p ? `${p.share.toFixed(1)}%` : '(-)'
                return (
                  <tr key={`${r.domain}-${i}`} className="border-b">
                    <td className="py-2 pr-4 font-medium">{i + 1}</td>
                    <td className="py-2 pr-4">{r.domain}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      <div className="flex items-baseline justify-end gap-2">
                        <span className="min-w-[3.5rem] text-right">
                          {r.visits.toLocaleString('ko-KR')}
                        </span>
                        <span className="min-w-[4rem] text-left text-xs text-muted-foreground">
                          {p ? `(${prevVisits})` : '(-)'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      <div className="flex items-baseline justify-end gap-2">
                        <span className="min-w-[3.5rem] text-right">{r.share.toFixed(1)}%</span>
                        <span className="min-w-[3.5rem] text-left text-xs text-muted-foreground">
                          {p ? `(${prevShare})` : '(-)'}
                        </span>
                      </div>
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
