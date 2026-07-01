import { MallTabs } from './mall-tabs'
import { DateRangeFilter } from './date-range-filter'
import { ProductsUnifiedTable } from './products-unified-table'
import { MappingManager } from './mapping-manager'
import type { DateRange, CategorySalesRow } from '@/lib/queries/products'

type Props = {
  brand: { id: string; name: string }
  malls: string[]
  mall: string
  range: DateRange
  sales: CategorySalesRow[]
}

export function ProductsPage({ brand, malls, mall, range, sales }: Props) {
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
          <ProductsUnifiedTable data={sales} />
          <MappingManager brandId={brand.id} mall={mall} />
        </>
      )}
    </div>
  )
}
