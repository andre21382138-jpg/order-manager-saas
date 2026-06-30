'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Kpis } from '@/lib/queries/ad-stats'

const CARDS: { key: keyof Kpis | 'ctr'; label: string; color: string; format: (k: Kpis) => string }[] = [
  { key: 'cost', label: '광고비', color: 'text-red-500', format: (k) => `₩${k.cost.toLocaleString('ko-KR')}` },
  { key: 'impressions', label: '노출수', color: 'text-blue-500', format: (k) => k.impressions.toLocaleString('ko-KR') },
  { key: 'clicks', label: '클릭수', color: 'text-green-500', format: (k) => k.clicks.toLocaleString('ko-KR') },
  {
    key: 'ctr',
    label: 'CTR',
    color: 'text-purple-500',
    format: (k) => (k.impressions === 0 ? '—' : `${((k.clicks / k.impressions) * 100).toFixed(2)}%`),
  },
]

export function AdKpiCards({ data, isLoading }: { data: Kpis | undefined; isLoading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CARDS.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${c.color}`}>
              {isLoading || !data ? '—' : c.format(data)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
