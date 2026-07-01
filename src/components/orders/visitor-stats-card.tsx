'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import type { VisitorRow } from '@/lib/queries/orders'

export function VisitorStatsCard({ data }: { data: VisitorRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">👁 방문자 통계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">총 방문자</div>
            <div className="text-lg font-bold text-cyan-700">
              {data.totalVisits.toLocaleString('ko-KR')}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">순 방문자</div>
            <div className="text-lg font-bold text-cyan-600">
              {data.uniqueVisits.toLocaleString('ko-KR')}
            </div>
          </div>
        </div>
        <div className="h-40 w-full">
          {data.daily.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              데이터 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : '—')}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="#06B6D4"
                  fill="#06B6D4"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
