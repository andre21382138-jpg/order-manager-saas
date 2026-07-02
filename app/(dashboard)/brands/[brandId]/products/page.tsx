import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ProductsClient, type Store } from '@/components/products/products-client'

export default async function BrandProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ mall?: string }>
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

  const activeMall =
    sp.mall && stores.some((s) => s.channelAccount === sp.mall)
      ? sp.mall
      : stores[0]?.channelAccount ?? ''
  const activeStore = stores.find((s) => s.channelAccount === activeMall) ?? null
  const activeChannel = activeStore?.channel ?? null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{brand.name} — 상품</h1>
      <ProductsClient
        brandId={brand.id}
        stores={stores}
        activeMall={activeMall}
        activeChannel={activeChannel}
      />
    </div>
  )
}
