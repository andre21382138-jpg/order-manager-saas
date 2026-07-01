import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ProductsPage } from '@/components/products/products-page'
import {
  getMallList,
  getCategorySales,
  type DateRange,
} from '@/lib/queries/products'

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

export default async function BrandProductsPage({
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
  const malls = await getMallList(supabase, brandId)
  const mall =
    sp.mall && malls.includes(sp.mall) ? sp.mall : (malls[0] ?? '자사몰')

  const sales =
    malls.length === 0 ? [] : await getCategorySales(supabase, brandId, mall, range)

  return (
    <ProductsPage
      brand={brand}
      malls={malls}
      mall={mall}
      range={range}
      sales={sales}
    />
  )
}
