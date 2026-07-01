import { MallTabs } from './mall-tabs'
import { DateRangeFilter } from './date-range-filter'
import { ProductInfoTable } from './product-info-table'
import { ProductSalesTable } from './product-sales-table'
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

export function ProductsPage({ brand, malls, mall, range, info, sales }: Props) {
  // isSelfMall: 자사몰 탭이면 판매가/원가 표시. 판단 기준: mall 이름에 '자사몰' 포함
  // (사용자 채널 별칭이라 정확히 '자사몰'이 아닐 수 있음. mall_type이 자사몰이면 catalog_products에 데이터 존재)
  const isSelfMall = mall === '자사몰' || info.some((r) => r.catalogProductId !== null)

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
          <ProductInfoTable data={info} isSelfMall={isSelfMall} />
          <ProductSalesTable data={sales} />
        </>
      )}
    </div>
  )
}
