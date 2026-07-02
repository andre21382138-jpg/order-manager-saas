import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ReportsClient, type Store } from '@/components/reports/reports-client'
import type { DateRange } from '@/lib/queries/reports'

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function defaultRange(): DateRange {
  const now = kstNow()
  const yesterday = new Date(now.getTime() - 86400000)
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  if (firstOfMonth.getTime() >= yesterday.getTime()) {
    return {
      from: ymd(new Date(yesterday.getTime() - 29 * 86400000)),
      to: ymd(yesterday),
    }
  }
  return { from: ymd(firstOfMonth), to: ymd(yesterday) }
}

export default async function BrandReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ mall?: string; from?: string; to?: string }>
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

  const dr = defaultRange()
  const range: DateRange = {
    from: sp.from ?? dr.from,
    to: sp.to ?? dr.to,
  }

  const { data: credsRaw } = await supabase
    .from('brand_credentials')
    .select('channel, channel_account, status')
    .eq('brand_id', brandId)
    .eq('status', 'active')
    .in('channel', ['cafe24', 'smartstore'])
    .order('channel')
    .order('channel_account')

  const stores: Store[] = (credsRaw ?? [])
    .filter((c): c is { channel: 'cafe24' | 'smartstore'; channel_account: string; status: string } =>
      c.channel === 'cafe24' || c.channel === 'smartstore'
    )
    .map((c) => ({ channel: c.channel, channelAccount: c.channel_account }))

  const validMalls = new Set<string>(['all', ...stores.map((s) => s.channelAccount)])
  const activeMall = sp.mall && validMalls.has(sp.mall) ? sp.mall : 'all'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{brand.name} — 결산조회</h1>
      <ReportsClient
        brandId={brand.id}
        stores={stores}
        activeMall={activeMall}
        range={range}
      />
    </div>
  )
}
