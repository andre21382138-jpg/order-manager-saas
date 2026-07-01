import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductCostEditor } from './product-cost-editor'
import type { ProductInfoRow } from '@/lib/queries/products'

function fmtWon(n: number | null): string {
  if (n === null) return '-'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

type Props = {
  data: ProductInfoRow[]
  isSelfMall: boolean
}

export function ProductInfoTable({ data, isSelfMall }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📦 상품정보</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">상품명</th>
                {isSelfMall && <th className="py-2 pr-4 text-right">판매가</th>}
                {isSelfMall && <th className="py-2 pr-4 text-right">원가</th>}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={isSelfMall ? 3 : 1} className="py-4 text-center text-muted-foreground">
                    상품 없음
                  </td>
                </tr>
              )}
              {data.map((r, i) => (
                <tr key={`${r.productName}-${i}`} className="border-b">
                  <td className="py-2 pr-4">{r.productName}</td>
                  {isSelfMall && (
                    <td className="py-2 pr-4 text-right">{fmtWon(r.price)}</td>
                  )}
                  {isSelfMall && (
                    <td className="py-2 pr-4 text-right">
                      {r.catalogProductId ? (
                        <ProductCostEditor productId={r.catalogProductId} initialCost={r.cost} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
