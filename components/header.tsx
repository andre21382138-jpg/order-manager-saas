import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { BrandSwitcher } from '@/components/brand-switcher'

export async function Header({ currentBrandId }: { currentBrandId?: string }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: brandsData } = await supabase
    .from('brands')
    .select('id, name, color')
    .order('created_at', { ascending: false })
  const brands = brandsData ?? []

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/brands" className="font-bold hover:underline">주문 &amp; 광고수집</Link>
          {brands.length > 0 && (
            <BrandSwitcher currentBrandId={currentBrandId ?? null} brands={brands} />
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && <span className="text-muted-foreground">{user.email}</span>}
          <form action="/api/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">로그아웃</Button>
          </form>
        </div>
      </div>
    </header>
  )
}
