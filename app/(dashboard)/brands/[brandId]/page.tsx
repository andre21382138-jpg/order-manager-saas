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

  return (
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
          첫 매체를 연결하면 데이터 수집이 시작됩니다.
        </p>
        <Link
          href={`/brands/${brand.id}/settings/connections`}
          className={cn(buttonVariants(), 'w-full')}
        >
          매체 연결하기
        </Link>
      </CardContent>
    </Card>
  )
}
