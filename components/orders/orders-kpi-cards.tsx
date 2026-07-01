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

function KpiCard({
  label,
  emoji,
  color,
  value,
  sub,
}: {
  label: string
  emoji: string
  color: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>{emoji}</span>
          <span>{label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-muted-foreground">{children}</h2>
}

export function OrdersKpiCards({ data, showVisits, showNew }: Props) {
  const totalMemberGuest = data.memberCount + data.guestCount
  const memberPct = totalMemberGuest > 0 ? (data.memberCount / totalMemberGuest) * 100 : 0
  const guestPct = totalMemberGuest > 0 ? (data.guestCount / totalMemberGuest) * 100 : 0
  const totalMemberOrders = data.memberNewCount + data.memberRepeatCount
  const memberNewPct = totalMemberOrders > 0 ? (data.memberNewCount / totalMemberOrders) * 100 : 0
  const memberRepeatPct =
    totalMemberOrders > 0 ? (data.memberRepeatCount / totalMemberOrders) * 100 : 0

  return (
    <div className="space-y-4">
      {/* 1. 매출정보 */}
      <div className="space-y-2">
        <SectionTitle>💰 매출정보</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="총 주문금액" emoji="💰" color="text-emerald-600" value={fmtWon(data.totalRevenue)} />
          <KpiCard label="주문 건수" emoji="🛒" color="text-blue-600" value={fmtCount(data.orderCount)} />
          <KpiCard label="환불 금액" emoji="↩️" color="text-rose-600" value={fmtWon(data.refundAmount)} />
          <KpiCard label="최종 매출" emoji="💵" color="text-emerald-700" value={fmtWon(data.finalRevenue)} />
        </div>
      </div>

      {/* 2. 구매전환률 & 객단가 */}
      <div className="space-y-2">
        <SectionTitle>📊 구매전환률 & 객단가</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="객단가"
            emoji="📊"
            color="text-purple-600"
            value={data.avgOrderValue === null ? '—' : fmtWon(data.avgOrderValue)}
          />
          {showVisits && (
            <>
              <KpiCard
                label="방문자수"
                emoji="👁"
                color="text-cyan-600"
                value={data.visits === null ? '—' : `${data.visits.toLocaleString('ko-KR')}명`}
              />
              <KpiCard label="구매 전환률" emoji="🎯" color="text-amber-600" value={fmtPercent(data.conversionRate)} />
            </>
          )}
        </div>
      </div>

      {/* 3. 고객 분석 (cafe24 mall일 때만) */}
      {showNew && (
        <div className="space-y-2">
          <SectionTitle>👥 고객 분석</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="회원 구매"
              emoji="🧑"
              color="text-blue-700"
              value={fmtCount(data.memberCount)}
              sub={`전체의 ${memberPct.toFixed(1)}%`}
            />
            <KpiCard
              label="비회원 구매"
              emoji="👤"
              color="text-slate-600"
              value={fmtCount(data.guestCount)}
              sub={`전체의 ${guestPct.toFixed(1)}%`}
            />
            <KpiCard
              label="회원 신규구매"
              emoji="🆕"
              color="text-green-600"
              value={fmtCount(data.memberNewCount)}
              sub={`회원 중 ${memberNewPct.toFixed(1)}%`}
            />
            <KpiCard
              label="회원 재구매"
              emoji="🔁"
              color="text-orange-600"
              value={fmtCount(data.memberRepeatCount)}
              sub={`회원 중 ${memberRepeatPct.toFixed(1)}%`}
            />
          </div>
        </div>
      )}
    </div>
  )
}
