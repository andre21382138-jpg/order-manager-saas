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
import type { DailyRevenuePoint } from '@/lib/queries/home-kpis'

export function DailyRevenueChart({ data }: { data: DailyRevenuePoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📈 일별 매출 (최근 7일)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              데이터 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${Math.round(v / 10000) / 100}M`
                      : v >= 1000
                      ? `${Math.round(v / 1000)}K`
                      : String(v)
                  }
                />
                <Tooltip
                  formatter={(v) => {
                    if (typeof v !== 'number') return '—'
                    return `₩${v.toLocaleString('ko-KR')}`
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  fill="#10B981"
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
