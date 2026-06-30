import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { HomeKpiCards } from '@/components/dashboard/home-kpi-cards'
import { DailyRevenueChart } from '@/components/dashboard/daily-revenue-chart'
import { MallShareChart } from '@/components/dashboard/mall-share-chart'
import {
  getHomeKpis,
  getDailyRevenue7d,
  getMallShare30d,
} from '@/lib/queries/home-kpis'

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

  const [kpis, daily, share] = await Promise.all([
    getHomeKpis(supabase, brandId),
    getDailyRevenue7d(supabase, brandId),
    getMallShare30d(supabase, brandId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 rounded-full"
          style={{ backgroundColor: brand.color ?? '#94a3b8' }}
        />
        <h1 className="text-2xl font-bold">{brand.name}</h1>
      </div>

      <HomeKpiCards data={kpis} />

      <div className="grid gap-4 md:grid-cols-2">
        <DailyRevenueChart data={daily} />
        <MallShareChart data={share} />
      </div>
    </div>
  )
}
