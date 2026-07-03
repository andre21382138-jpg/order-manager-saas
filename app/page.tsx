import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [ownedRes, memberRes] = await Promise.all([
    supabase.from('brands').select('id').eq('owner_id', user.id).limit(1),
    supabase.from('brand_users').select('brand_id').eq('user_id', user.id).limit(1),
  ])
  const firstBrandId =
    ownedRes.data?.[0]?.id ??
    memberRes.data?.[0]?.brand_id ??
    null

  if (firstBrandId) redirect(`/brands/${firstBrandId}`)
  redirect('/brands')
}
