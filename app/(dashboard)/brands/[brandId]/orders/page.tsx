import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function BrandOrdersStubPage({
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
      <h1 className="text-2xl font-bold">{brand.name} — 매출 분석</h1>
      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            매출 분석 페이지는 후속 Plan 10에서 제공될 예정입니다.
          </p>
          <p className="text-sm text-muted-foreground">
            현재 홈 대시보드의 "오늘 매출 / 이번달 누적 / 일별 매출 / 매체별 점유율" 카드와 차트로 핵심 매출 정보를 확인하실 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
