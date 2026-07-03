import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brands, error: brandsErr } = await supabase
    .from('brands')
    .select('id, name')
    .order('created_at', { ascending: true })

  // 디버그: 결과를 화면에 표시 후 이동
  if (brands && brands.length > 0) {
    redirect(`/brands/${brands[0].id}`)
  }

  return (
    <div className="p-8 space-y-2 text-sm">
      <h1 className="text-lg font-bold">디버그 정보</h1>
      <div>user.id: <code>{user.id}</code></div>
      <div>user.email: <code>{user.email}</code></div>
      <div>authErr: <code>{JSON.stringify(authErr)}</code></div>
      <div>brands count: <code>{brands?.length ?? 'null'}</code></div>
      <div>brandsErr: <code>{JSON.stringify(brandsErr)}</code></div>
      <div>brands data: <code>{JSON.stringify(brands)}</code></div>
    </div>
  )
}
