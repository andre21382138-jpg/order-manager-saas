import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdStatsPage } from '@/components/ad-stats/ad-stats-page'
import { cn } from '@/lib/utils'

const AD_CHANNELS = [
  { id: 'naver_ad', label: '네이버광고', enabled: true },
  { id: 'google_ads', label: '구글광고', enabled: false },
  { id: 'youtube_ads', label: '유튜브광고', enabled: false },
  { id: 'meta_ads', label: '메타광고', enabled: false },
] as const

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

  const { count } = await supabase
    .from('brand_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('channel', 'naver_ad')
    .eq('status', 'active')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {AD_CHANNELS.map((c) => {
          const active = c.id === 'naver_ad'
          return (
            <span
              key={c.id}
              className={cn(
                'rounded-md border px-3 py-1 text-sm',
                active
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'cursor-not-allowed border-input bg-muted text-muted-foreground'
              )}
              title={c.enabled ? undefined : '준비 중 — 후속 Plan에서 제공'}
            >
              {c.label}
              {!c.enabled && <span className="ml-1 text-xs">(준비 중)</span>}
            </span>
          )
        })}
      </div>
      <AdStatsPage brand={brand} hasCredential={(count ?? 0) > 0} />
    </div>
  )
}
