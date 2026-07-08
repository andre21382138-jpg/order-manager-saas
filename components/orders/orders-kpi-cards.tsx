import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { OrderKpis, DateRange } from '@/lib/queries/orders'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return `${n.toLocaleString('ko-KR')}건`
}
function fmtPercent(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`
}
function fmtMMDD(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

type Props = {
  data: OrderKpis
  showVisits: boolean
  showNew: boolean
  prev?: OrderKpis
  prevRange?: DateRange
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

type Delta = { text: string; tone: 'up' | 'down' | 'flat' | 'none' }

function buildDelta(
  cur: number | null,
  prev: number | null,
  format: (abs: number) => string
): Delta {
  if (cur === null || prev === null) return { text: '—', tone: 'none' }
  const d = cur - prev
  if (d === 0) return { text: '동일', tone: 'flat' }
  const sign = d > 0 ? '+' : '-'
  return {
    text: `${sign}${format(Math.abs(d))}`,
    tone: d > 0 ? 'up' : 'down',
  }
}

function PrevComparisonCard({
  data,
  prev,
  prevRange,
}: {
  data: OrderKpis
  prev: OrderKpis
  prevRange: DateRange
}) {
  const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
  const count = (n: number) => `${n.toLocaleString('ko-KR')}건`
  const visits = (n: number) => `${n.toLocaleString('ko-KR')}명`
  const pctPoint = (n: number) => `${n.toFixed(1)}%p`

  const rows = [
    { label: '주문건수', delta: buildDelta(data.orderCount, prev.orderCount, count) },
    { label: '최종매출', delta: buildDelta(data.finalRevenue, prev.finalRevenue, won) },
    { label: '방문자수', delta: buildDelta(data.visits, prev.visits, visits) },
    { label: '구매전환', delta: buildDelta(data.conversionRate, prev.conversionRate, pctPoint) },
    { label: '객단가', delta: buildDelta(data.avgOrderValue, prev.avgOrderValue, won) },
  ]
  const toneClass = (tone: Delta['tone']) =>
    tone === 'up'
      ? 'text-emerald-600'
      : tone === 'down'
        ? 'text-red-600'
        : 'text-muted-foreground'
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
          <span>📅</span>
          <span>전월 동기간 비교</span>
          <span className="text-[10px] text-muted-foreground/70">
            ({fmtMMDD(prevRange.from)}~{fmtMMDD(prevRange.to)})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] leading-[1.35]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline gap-1">
              <span className="text-muted-foreground shrink-0">{r.label}</span>
              <span className={cn('font-medium tabular-nums', toneClass(r.delta.tone))}>
                {r.delta.text}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function OrdersKpiCards({ data, showVisits, showNew, prev, prevRange }: Props) {
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
          {prev && prevRange && <PrevComparisonCard data={data} prev={prev} prevRange={prevRange} />}
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
