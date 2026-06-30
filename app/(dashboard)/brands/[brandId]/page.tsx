import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function BrandHomePage({
  params,
}: {
  params: Promise<{ brandId: string }>
}) {
  const { brandId } = await params
  const supabase = await createServerClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, color')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  const { count: credCount } = await supabase
    .from('brand_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('status', 'active')

  const hasCreds = (credCount ?? 0) > 0

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: brand.color ?? '#94a3b8' }}
            />
            {brand.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {hasCreds
              ? `${credCount}개 매체가 연결되어 있습니다.`
              : '첫 매체를 연결하면 데이터 수집이 시작됩니다.'}
          </p>
          <Link
            href={`/brands/${brand.id}/settings/connections`}
            className={cn(buttonVariants({ variant: hasCreds ? 'outline' : 'default' }), 'w-full')}
          >
            {hasCreds ? '매체 연결 관리' : '매체 연결하기'}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>광고 분석</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            네이버 검색광고 KPI, 캠페인/키워드별 성과, 트렌드 추이.
          </p>
          <Link
            href={`/brands/${brand.id}/ad-stats`}
            className={cn(buttonVariants(), 'w-full')}
          >
            광고 분석 보기
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
