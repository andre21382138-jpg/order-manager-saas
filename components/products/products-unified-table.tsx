import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategorySalesRow } from '@/lib/queries/products'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}
function fmtPct(n: number | null): string {
  if (n === null) return '-'
  return `${n.toFixed(1)}%`
}

type Props = {
  data: CategorySalesRow[]
}

export function ProductsUnifiedTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📊 상품구분 분석</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="whitespace-nowrap py-2 pr-4">#</th>
                <th className="whitespace-nowrap py-2 pr-4">상품구분</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">판매수량</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">매출액</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">원가비중</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">광고비</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">광고비중</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">상품 수</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {data.map((r, i) => (
                <tr key={`${r.categoryId ?? 'unmapped'}-${r.categoryName}`} className="border-b">
                  <td className="whitespace-nowrap py-2 pr-4 font-medium">{i + 1}</td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {r.categoryName}
                    {r.categoryId === null && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        ⚠️ 미분류
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.qty)}개</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.amount)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtPct(r.costRate)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.adCost)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtPct(r.adRate)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.productCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
