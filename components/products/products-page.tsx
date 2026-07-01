import { MallTabs } from './mall-tabs'
import { DateRangeFilter } from './date-range-filter'
import { ProductsUnifiedTable, type UnifiedRow } from './products-unified-table'
import type {
  DateRange,
  ProductInfoRow,
  ProductSalesRow,
} from '@/lib/queries/products'

type Props = {
  brand: { id: string; name: string }
  malls: string[]
  mall: string
  range: DateRange
  info: ProductInfoRow[]
  sales: ProductSalesRow[]
}

function mergeRows(info: ProductInfoRow[], sales: ProductSalesRow[]): UnifiedRow[] {
  // 상품 목록 = info 기준. sales의 상품명이 info에 없으면 추가
  const salesByName = new Map<string, ProductSalesRow>()
  for (const s of sales) salesByName.set(s.productName, s)
  const infoByName = new Map<string, ProductInfoRow>()
  for (const i of info) infoByName.set(i.productName, i)

  const allNames = new Set<string>([
    ...info.map((i) => i.productName),
    ...sales.map((s) => s.productName),
  ])

  const rows: UnifiedRow[] = Array.from(allNames).map((name) => {
    const i = infoByName.get(name)
    const s = salesByName.get(name)
    const qty = s?.qty ?? 0
    const amount = s?.amount ?? 0
    const cost = i?.cost ?? null
    const costTotal = cost !== null ? cost * qty : null
    const costRate = amount > 0 && costTotal !== null ? (costTotal / amount) * 100 : null
    const adCost = s?.adCost ?? 0
    const adRate = amount > 0 ? (adCost / amount) * 100 : null
    return {
      catalogProductId: i?.catalogProductId ?? null,
      productName: name,
      cost,
      price: i?.price ?? null,
      qty,
      amount,
      costTotal,
      costRate,
      adCost,
      adRate,
    }
  })

  // 매출 높은 순 → 매출 0은 뒤로
  return rows.sort((a, b) => b.amount - a.amount)
}

export function ProductsPage({ brand, malls, mall, range, info, sales }: Props) {
  const isSelfMall = info.some((r) => r.catalogProductId !== null)
  const rows = mergeRows(info, sales)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{brand.name} — 상품 분석</h1>
        <DateRangeFilter brandId={brand.id} mall={mall} value={range} />
      </div>

      {malls.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          아직 쇼핑몰 판매 데이터가 없습니다. 매체 연결에서 카페24 또는 스마트스토어를 등록 후 sync 완료 후 표시됩니다.
        </div>
      ) : (
        <>
          <MallTabs brandId={brand.id} malls={malls} activeMall={mall} range={range} />
          <ProductsUnifiedTable data={rows} isSelfMall={isSelfMall} />
        </>
      )}
    </div>
  )
}
