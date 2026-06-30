import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdStatsPage } from '@/components/ad-stats/ad-stats-page'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default async function Page({
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

  // 사용자가 등록한 광고 자격증명들 (각 자격증명을 매체 탭으로)
  const { data: adCreds } = await supabase
    .from('brand_credentials')
    .select('id, channel, channel_account')
    .eq('brand_id', brandId)
    .eq('channel', 'naver_ad')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const tabs = adCreds ?? []
  const hasCredential = tabs.length > 0

  return (
    <div className="space-y-4">
      {hasCredential ? (
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <span className="text-xs text-muted-foreground">광고 매체:</span>
          {tabs.map((c, i) => (
            <span
              key={c.id}
              className={cn(
                'rounded-md border px-3 py-1 text-sm',
                i === 0
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'border-input bg-background text-muted-foreground'
              )}
            >
              {c.channel_account}
            </span>
          ))}
          <Link
            href={`/brands/${brand.id}/settings/connections`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'ml-auto'
            )}
          >
            + 광고 매체 추가
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <span className="text-sm text-muted-foreground">
            등록된 광고 매체가 없습니다.
          </span>
          <Link
            href={`/brands/${brand.id}/settings/connections`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            + 광고 매체 추가
          </Link>
        </div>
      )}
      <AdStatsPage brand={brand} hasCredential={hasCredential} />
    </div>
  )
}
