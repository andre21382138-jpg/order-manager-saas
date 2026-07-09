import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { OrderKpis, DateRange, ProductRow } from '@/lib/queries/orders'
import { ProductRankingTable } from './product-ranking-table'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtDelta(cur: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  const diff = cur - prev
  if (diff === 0 || (prev === 0 && cur === 0)) return { text: '동일', tone: 'flat' }
  const sign = diff > 0 ? '+' : '-'
  return { text: `${sign}${fmtWon(Math.abs(diff))}`, tone: diff > 0 ? 'up' : 'down' }
}
function fmtMMDD(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

const toneClass = (tone: 'up' | 'down' | 'flat') =>
  tone === 'up'
    ? 'text-emerald-600'
    : tone === 'down'
      ? 'text-red-600'
      : 'text-muted-foreground'

type Props = {
  kpis: OrderKpis
  prevKpis: OrderKpis
  prevRange: DateRange
  perMallKpis: {
    mall: string
    kpis: OrderKpis
    prevKpis: OrderKpis
    products: ProductRow[]
    prevProducts: ProductRow[]
  }[]
}

export function AllMallsOverview({ kpis, prevKpis, prevRange, perMallKpis }: Props) {
  const totalDelta = fmtDelta(kpis.finalRevenue, prevKpis.finalRevenue)
  const totalCurrent = kpis.finalRevenue
  const sortedMalls = [...perMallKpis].sort((a, b) => b.kpis.finalRevenue - a.kpis.finalRevenue)

  return (
    <div className="space-y-6">
      {/* 총 매출액 카드 (전월 동기간 비교) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💰 총 매출액 (최종매출 기준)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-extrabold tabular-nums">{fmtWon(totalCurrent)}</div>
            <div className={cn('text-sm font-medium tabular-nums', toneClass(totalDelta.tone))}>
              {totalDelta.text}
            </div>
            <div className="text-xs text-muted-foreground">
              전월 {fmtMMDD(prevRange.from)}~{fmtMMDD(prevRange.to)} {fmtWon(prevKpis.finalRevenue)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 쇼핑몰별 매출 비교 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏬 쇼핑몰별 매출 비교</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">쇼핑몰</th>
                  <th className="py-2 pr-4 text-right">매출액</th>
                  <th className="py-2 pr-4 text-right">전월</th>
                  <th className="py-2 pr-4 text-right">증감</th>
                  <th className="py-2 pr-4 text-right">비중</th>
                </tr>
              </thead>
              <tbody>
                {sortedMalls.map((row) => {
                  const share = totalCurrent > 0 ? (row.kpis.finalRevenue / totalCurrent) * 100 : 0
                  const delta = fmtDelta(row.kpis.finalRevenue, row.prevKpis.finalRevenue)
                  return (
                    <tr key={row.mall} className="border-b">
                      <td className="py-2 pr-4 font-medium">{row.mall}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtWon(row.kpis.finalRevenue)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {fmtWon(row.prevKpis.finalRevenue)}
                      </td>
                      <td className={cn('py-2 pr-4 text-right tabular-nums', toneClass(delta.tone))}>
                        {delta.text}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{share.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2 pr-4">합계</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtWon(totalCurrent)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {fmtWon(prevKpis.finalRevenue)}
                  </td>
                  <td className={cn('py-2 pr-4 text-right tabular-nums', toneClass(totalDelta.tone))}>
                    {totalDelta.text}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 쇼핑몰별 상품 판매 순위 (좌우 배치) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {sortedMalls.map((row) => (
          <div key={`ranking-${row.mall}`} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{row.mall}</h3>
            <ProductRankingTable data={row.products} prev={row.prevProducts} />
          </div>
        ))}
      </div>
    </div>
  )
}
