import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProductSalesRow } from '@/lib/queries/products'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

function fmtChange(n: number | null): { text: string; color: string } {
  if (n === null) return { text: '신규', color: 'text-cyan-600' }
  const sign = n >= 0 ? '+' : ''
  const color = n > 0 ? 'text-emerald-600' : n < 0 ? 'text-rose-600' : 'text-muted-foreground'
  return { text: `${sign}${n.toFixed(1)}%`, color }
}

type Props = {
  data: ProductSalesRow[]
}

export function ProductSalesTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📊 판매정보 (매출순)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">상품명</th>
                <th className="py-2 pr-4 text-right">판매수량</th>
                <th className="py-2 pr-4 text-right">매출액</th>
                <th className="py-2 pr-4 text-right">비중</th>
                <th className="py-2 pr-4 text-right">전월 동기간</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {data.map((r, i) => {
                const change = fmtChange(r.changePercent)
                return (
                  <tr key={`${r.productName}-${i}`} className="border-b">
                    <td className="py-2 pr-4 font-medium">{i + 1}</td>
                    <td className="py-2 pr-4">{r.productName}</td>
                    <td className="py-2 pr-4 text-right">
                      {r.qty.toLocaleString('ko-KR')}개
                    </td>
                    <td className="py-2 pr-4 text-right">{fmtWon(r.amount)}</td>
                    <td className="py-2 pr-4 text-right">{r.share.toFixed(1)}%</td>
                    <td className={`py-2 pr-4 text-right ${change.color}`}>{change.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
