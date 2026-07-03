import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// v2: Home page - brand auto-redirect
export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // brand_users 조인으로 접근 가능한 브랜드 조회 (RLS 우회 목적으로 명시적)
  const [ownedResult, memberResult] = await Promise.all([
    supabase.from('brands').select('id').eq('owner_id', user.id).limit(1),
    supabase.from('brand_users').select('brand_id').eq('user_id', user.id).limit(1),
  ])

  const firstBrandId =
    ownedResult.data?.[0]?.id ??
    memberResult.data?.[0]?.brand_id ??
    null

  if (firstBrandId) {
    redirect(`/brands/${firstBrandId}`)
  }

  return (
    <div className="p-8 space-y-2 text-sm">
      <h1 className="text-lg font-bold">디버그 v2</h1>
      <div>user.email: <code>{user.email}</code></div>
      <div>ownedResult.data: <code>{JSON.stringify(ownedResult.data)}</code></div>
      <div>ownedResult.error: <code>{JSON.stringify(ownedResult.error)}</code></div>
      <div>memberResult.data: <code>{JSON.stringify(memberResult.data)}</code></div>
      <div>memberResult.error: <code>{JSON.stringify(memberResult.error)}</code></div>
    </div>
  )
}
