import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HomeKpis } from '@/lib/queries/home-kpis'

type CardDef = {
  label: string
  emoji: string
  color: string
  format: (k: HomeKpis) => string
}

const CARDS: CardDef[] = [
  {
    label: '오늘 매출',
    emoji: '💰',
    color: 'text-emerald-600',
    format: (k) => `₩${Math.round(k.todayRevenue).toLocaleString('ko-KR')}`,
  },
  {
    label: '오늘 주문',
    emoji: '🛒',
    color: 'text-blue-600',
    format: (k) => `${k.todayOrderCount.toLocaleString('ko-KR')}건`,
  },
  {
    label: '이번달 누적',
    emoji: '📅',
    color: 'text-emerald-700',
    format: (k) => `₩${Math.round(k.monthRevenue).toLocaleString('ko-KR')}`,
  },
  {
    label: '평균 주문가',
    emoji: '📊',
    color: 'text-purple-600',
    format: (k) =>
      k.avgOrderValue === 0
        ? '—'
        : `₩${Math.round(k.avgOrderValue).toLocaleString('ko-KR')}`,
  },
  {
    label: '어제 광고비',
    emoji: '📣',
    color: 'text-rose-600',
    format: (k) => `₩${Math.round(k.yesterdayAdCost).toLocaleString('ko-KR')}`,
  },
  {
    label: '30일 광고비',
    emoji: '💸',
    color: 'text-rose-700',
    format: (k) => `₩${Math.round(k.thirtyDayAdCost).toLocaleString('ko-KR')}`,
  },
  {
    label: '7일 ROAS',
    emoji: '🎯',
    color: 'text-amber-600',
    format: (k) =>
      k.sevenDayRoas === null ? '—' : `${k.sevenDayRoas.toFixed(0)}%`,
  },
  {
    label: '활성 캠페인',
    emoji: '🟢',
    color: 'text-cyan-600',
    format: (k) => `${k.activeCampaignCount.toLocaleString('ko-KR')}개`,
  },
]

export function HomeKpiCards({ data }: { data: HomeKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {CARDS.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${c.color}`}>{c.format(data)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
