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
  value,
  sub,
}: {
  label: string
  emoji: string
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
        <div className="text-xl font-bold text-foreground">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function VsCard({
  title,
  emoji,
  leftLabel,
  leftCount,
  rightLabel,
  rightCount,
}: {
  title: string
  emoji: string
  leftLabel: string
  leftCount: number
  rightLabel: string
  rightCount: number
}) {
  const total = leftCount + rightCount
  const leftPct = total > 0 ? (leftCount / total) * 100 : 0
  const rightPct = total > 0 ? (rightCount / total) * 100 : 0
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>{emoji}</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">{leftLabel}</div>
            <div className="text-xl font-bold text-foreground">
              {leftCount.toLocaleString('ko-KR')}
              <span className="ml-1 text-sm font-normal text-muted-foreground">건</span>
            </div>
            <div className="text-xs text-muted-foreground">{leftPct.toFixed(1)}%</div>
          </div>
          <div className="text-lg font-semibold text-muted-foreground">vs</div>
          <div className="min-w-0 flex-1 text-right">
            <div className="text-xs text-muted-foreground">{rightLabel}</div>
            <div className="text-xl font-bold text-foreground">
              {rightCount.toLocaleString('ko-KR')}
              <span className="ml-1 text-sm font-normal text-muted-foreground">건</span>
            </div>
            <div className="text-xs text-muted-foreground">{rightPct.toFixed(1)}%</div>
          </div>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-foreground/70" style={{ width: `${leftPct}%` }} />
          <div className="bg-foreground/30" style={{ width: `${rightPct}%` }} />
        </div>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-muted-foreground">{children}</h2>
}

export function OrdersKpiCards({ data, showVisits, showNew }: Props) {
  return (
    <div className="space-y-4">
      {/* 1. 매출정보 */}
      <div className="space-y-2">
        <SectionTitle>💰 매출정보</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="총 주문금액" emoji="💰" value={fmtWon(data.totalRevenue)} />
          <KpiCard label="주문 건수" emoji="🛒" value={fmtCount(data.orderCount)} />
          <KpiCard label="환불 금액" emoji="↩️" value={fmtWon(data.refundAmount)} />
          <KpiCard label="최종 매출" emoji="💵" value={fmtWon(data.finalRevenue)} />
        </div>
      </div>

      {/* 2. 구매전환률 & 객단가 */}
      <div className="space-y-2">
        <SectionTitle>📊 구매전환률 & 객단가</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="객단가" emoji="📊" value={data.avgOrderValue === null ? '—' : fmtWon(data.avgOrderValue)} />
          {showVisits && (
            <>
              <KpiCard
                label="방문자수"
                emoji="👁"
                value={data.visits === null ? '—' : `${data.visits.toLocaleString('ko-KR')}명`}
              />
              <KpiCard label="구매 전환률" emoji="🎯" value={fmtPercent(data.conversionRate)} />
            </>
          )}
        </div>
      </div>

      {/* 3. 고객 분석 (cafe24 mall일 때만) — vs 카드 2개 */}
      {showNew && (
        <div className="space-y-2">
          <SectionTitle>👥 고객 분석</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <VsCard
              title="회원 vs 비회원 구매"
              emoji="🧑"
              leftLabel="회원 구매"
              leftCount={data.memberCount}
              rightLabel="비회원 구매"
              rightCount={data.guestCount}
            />
            <VsCard
              title="신규 vs 재구매 (회원 기준)"
              emoji="🔁"
              leftLabel="신규구매"
              leftCount={data.memberNewCount}
              rightLabel="재구매"
              rightCount={data.memberRepeatCount}
            />
          </div>
        </div>
      )}
    </div>
  )
}
