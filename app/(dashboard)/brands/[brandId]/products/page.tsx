import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function BrandProductsStubPage({
  params,
}: {
  params: Promise<{ brandId: string }>
}) {
  const { brandId } = await params
  const supabase = await createServerClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{brand.name} — 상품 분석</h1>
      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            상품 분석 페이지는 후속 Plan 11에서 제공될 예정입니다. (catalog_products + orders join — 상품별 매출/판매 추이)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
