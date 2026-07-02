import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function BrandReportsPage({
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{brand.name} — 결산조회</h1>
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        🛠 <b>준비 중</b> — 결산조회 페이지는 곧 제공될 예정입니다.
      </div>
    </div>
  )
}
