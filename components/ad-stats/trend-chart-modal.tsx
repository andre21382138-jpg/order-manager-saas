'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createBrowserClient } from '@/lib/supabase/client'
import { getTrendByUnitId, type DateRange, type TrendPoint } from '@/lib/queries/ad-stats'

type Metric = 'cost' | 'clicks' | 'conversions' | 'roas'

const METRIC_LABEL: Record<Metric, string> = {
  cost: '광고비',
  clicks: '클릭',
  conversions: '전환',
  roas: 'ROAS',
}

const METRIC_COLOR: Record<Metric, string> = {
  cost: '#EF4444',
  clicks: '#10B981',
  conversions: '#F59E0B',
  roas: '#8B5CF6',
}

function value(p: TrendPoint, m: Metric): number {
  if (m === 'cost') return p.cost
  if (m === 'clicks') return p.clicks
  if (m === 'conversions') return p.conversions
  return p.cost === 0 ? 0 : (p.conversion_revenue / p.cost) * 100
}

function fmt(n: number, m: Metric): string {
  if (m === 'cost') return `₩${n.toLocaleString('ko-KR')}`
  if (m === 'roas') return `${n.toFixed(0)}%`
  return n.toLocaleString('ko-KR')
}

export function TrendChartModal({
  brandId: _brandId,
  unit,
  range,
  onClose,
}: {
  brandId: string
  unit: { id: string; name: string }
  range: DateRange
  onClose: () => void
}) {
  const [metric, setMetric] = useState<Metric>('cost')
  const supabase = createBrowserClient()
  const { data, isLoading } = useSWR(['trend', unit.id, range.from, range.to], () =>
    getTrendByUnitId(supabase, unit.id, range)
  )

  const series = useMemo(
    () => (data ?? []).map((p) => ({ date: p.date, value: value(p, metric) })),
    [data, metric]
  )

  const stats = useMemo(() => {
    if (series.length === 0) return { avg: 0, max: 0, min: 0, change: 0 }
    const values = series.map((s) => s.value)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const max = Math.max(...values)
    const min = Math.min(...values)
    const first = values[0]
    const last = values[values.length - 1]
    const change = first === 0 ? 0 : ((last - first) / first) * 100
    return { avg, max, min, change }
  }, [series])

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{unit.name} — 추이</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md border px-3 py-1 text-sm ${
                metric === m ? 'border-foreground bg-foreground text-background' : 'border-input bg-background'
              }`}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="h-64 w-full">
          {isLoading && <div className="flex h-full items-center justify-center text-muted-foreground">로딩 중...</div>}
          {!isLoading && series.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">데이터 없음</div>
          )}
          {!isLoading && series.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v, metric) : String(v ?? '')} />
                <Line type="monotone" dataKey="value" stroke={METRIC_COLOR[metric]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="평균" value={fmt(stats.avg, metric)} />
          <StatCard label="최대" value={fmt(stats.max, metric)} />
          <StatCard label="최소" value={fmt(stats.min, metric)} />
          <StatCard label="변화율" value={`${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(1)}%`} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  )
}
