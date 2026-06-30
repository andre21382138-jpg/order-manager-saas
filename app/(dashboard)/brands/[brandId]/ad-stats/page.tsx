import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdStatsPage } from '@/components/ad-stats/ad-stats-page'

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

  return <AdStatsPage brand={brand} hasCredential={(count ?? 0) > 0} />
}
