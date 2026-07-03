import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 접근 가능한 첫 브랜드로 이동. 없으면 /brands 리스트로.
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)

  if (brands && brands.length > 0) {
    redirect(`/brands/${brands[0].id}`)
  }
  redirect('/brands')
}
