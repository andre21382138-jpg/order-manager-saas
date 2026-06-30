'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { MallSharePoint } from '@/lib/queries/home-kpis'

const COLORS: Record<string, string> = {
  자사몰: '#8B5CF6',
  브랜드스토어: '#10B981',
  도깨비나라: '#F59E0B',
  paleo: '#3B82F6',
  스마트스토어: '#EC4899',
  미분류: '#94A3B8',
}

function colorOf(mall: string): string {
  return COLORS[mall] ?? '#64748B'
}

export function MallShareChart({ data }: { data: MallSharePoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">🥧 매체별 매출 점유율 (30일)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              데이터 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="revenue"
                  nameKey="mall_type"
                  innerRadius="40%"
                  outerRadius="75%"
                  paddingAngle={2}
                >
                  {data.map((d) => (
                    <Cell key={d.mall_type} fill={colorOf(d.mall_type)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _name, item) => {
                    if (typeof v !== 'number') return '—'
                    const payload = item?.payload as MallSharePoint | undefined
                    const share = payload?.share ?? 0
                    return [
                      `₩${v.toLocaleString('ko-KR')} (${share.toFixed(1)}%)`,
                      payload?.mall_type ?? '',
                    ]
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
