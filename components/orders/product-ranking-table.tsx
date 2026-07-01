import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProductRow } from '@/lib/queries/orders'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function ProductRankingTable({ data }: { data: ProductRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">🏆 상품 판매 순위 (Top 10)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">상품명</th>
                <th className="py-2 pr-4 text-right">판매 수량</th>
                <th className="py-2 pr-4 text-right">매출액</th>
                <th className="py-2 pr-4 text-right">비중</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {data.map((r, i) => (
                <tr key={`${r.product_name}-${i}`} className="border-b">
                  <td className="py-2 pr-4 font-medium">{i + 1}</td>
                  <td className="py-2 pr-4">{r.product_name}</td>
                  <td className="py-2 pr-4 text-right">
                    {r.qty.toLocaleString('ko-KR')}개
                  </td>
                  <td className="py-2 pr-4 text-right">{fmtWon(r.amount)}</td>
                  <td className="py-2 pr-4 text-right">{r.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
