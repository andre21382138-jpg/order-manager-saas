import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductCostEditor } from './product-cost-editor'
import type { ProductInfoRow, ProductSalesRow } from '@/lib/queries/products'

function fmtWon(n: number | null): string {
  if (n === null) return '-'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}
function fmtPct(n: number | null): string {
  if (n === null) return '-'
  return `${n.toFixed(1)}%`
}

export type UnifiedRow = {
  catalogProductId: string | null
  productName: string
  cost: number | null
  price: number | null
  qty: number
  amount: number
  costTotal: number | null // cost * qty
  costRate: number | null // costTotal / amount * 100
  adCost: number | null // Plan 12 후속 — 지금은 null
  adRate: number | null
}

type Props = {
  data: UnifiedRow[]
  isSelfMall: boolean
}

export function ProductsUnifiedTable({ data, isSelfMall }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📊 상품 분석</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="whitespace-nowrap py-2 pr-4">#</th>
                <th className="whitespace-nowrap py-2 pr-4">상품명</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">원가</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">판매가</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">판매수량</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">매출액</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">원가비중</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">광고비</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">광고비중</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-muted-foreground">
                    상품 없음
                  </td>
                </tr>
              )}
              {data.map((r, i) => (
                <tr key={`${r.catalogProductId ?? r.productName}-${i}`} className="border-b">
                  <td className="whitespace-nowrap py-2 pr-4 font-medium">{i + 1}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{r.productName}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">
                    {isSelfMall && r.catalogProductId ? (
                      <ProductCostEditor productId={r.catalogProductId} initialCost={r.cost} />
                    ) : (
                      <span className="text-muted-foreground">{fmtWon(r.cost)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.price)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.qty)}개</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.amount)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtPct(r.costRate)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.adCost)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtPct(r.adRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
