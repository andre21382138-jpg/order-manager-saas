import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrderKpis } from '@/lib/queries/orders'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return `${n.toLocaleString('ko-KR')}건`
}
function fmtPercent(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`
}

type Props = {
  data: OrderKpis
  showVisits: boolean
  showNew: boolean
}

export function OrdersKpiCards({ data, showVisits, showNew }: Props) {
  const cards: { label: string; emoji: string; color: string; value: string }[] = [
    { label: '총 주문금액', emoji: '💰', color: 'text-emerald-600', value: fmtWon(data.totalRevenue) },
    { label: '주문 건수', emoji: '🛒', color: 'text-blue-600', value: fmtCount(data.orderCount) },
    { label: '최종 매출', emoji: '💵', color: 'text-emerald-700', value: fmtWon(data.finalRevenue) },
    { label: '환불 금액', emoji: '↩️', color: 'text-rose-600', value: fmtWon(data.refundAmount) },
    {
      label: '객단가',
      emoji: '📊',
      color: 'text-purple-600',
      value: data.avgOrderValue === null ? '—' : fmtWon(data.avgOrderValue),
    },
  ]
  if (showVisits) {
    cards.push({
      label: '방문자수',
      emoji: '👁',
      color: 'text-cyan-600',
      value: data.visits === null ? '—' : `${data.visits.toLocaleString('ko-KR')}명`,
    })
    cards.push({
      label: '구매 전환률',
      emoji: '🎯',
      color: 'text-amber-600',
      value: fmtPercent(data.conversionRate),
    })
  }
  if (showNew) {
    cards.push({
      label: '신규 주문 비율',
      emoji: '🆕',
      color: 'text-green-600',
      value: fmtPercent(data.newOrderRate),
    })
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
