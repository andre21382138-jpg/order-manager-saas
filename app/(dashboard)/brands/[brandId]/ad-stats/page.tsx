import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdStatsPage } from '@/components/ad-stats/ad-stats-page'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const CHANNEL_LABEL: Record<string, string> = {
  naver_ad: '네이버광고',
  google_ads: '구글애즈',
  facebook_ad: '페이스북광고',
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ channel?: string }>
}) {
  const { brandId } = await params
  const sp = await searchParams
  const supabase = await createServerClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  const { data: adCreds } = await supabase
    .from('brand_credentials')
    .select('id, channel, channel_account')
    .eq('brand_id', brandId)
    .in('channel', ['naver_ad', 'google_ads', 'facebook_ad'])
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const tabs = adCreds ?? []
  const hasCredential = tabs.length > 0
  const validChannels = new Set(tabs.map((c) => c.channel))
  const activeChannel = sp.channel && validChannels.has(sp.channel)
    ? sp.channel
    : (tabs[0]?.channel ?? null)

  return (
    <div className="space-y-4">
      {hasCredential ? (
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <span className="text-xs text-muted-foreground">광고 매체:</span>
          {tabs.map((c) => {
            const active = c.channel === activeChannel
            const href = `/brands/${brand.id}/ad-stats?channel=${c.channel}` as Route
            return (
              <Link
                key={c.id}
                href={href}
                prefetch={false}
                className={cn(
                  'rounded-md border px-3 py-1 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background font-medium'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {CHANNEL_LABEL[c.channel] ?? c.channel} · {c.channel_account}
              </Link>
            )
          })}
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
      <AdStatsPage brand={brand} hasCredential={hasCredential} channel={activeChannel} />
    </div>
  )
}
