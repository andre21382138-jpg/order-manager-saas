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
    <header className="border-b border-slate-200 bg-white">
      <div className="flex h-14 items-stretch">
        {/* 사이드바 폭과 일치하는 좌측 컬럼 (로고 영역) */}
        <div className="hidden md:flex w-[240px] shrink-0 items-center border-r-2 border-slate-200 bg-slate-100 px-4">
          <Link
            href="/brands"
            className="text-sm font-extrabold tracking-tight text-slate-900 hover:opacity-80"
          >
            쇼핑몰 정산 프로그램
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between px-4">
          <div className="flex items-center gap-4 pl-10 md:pl-0">
            <Link href="/brands" className="text-sm font-bold hover:underline md:hidden">
              쇼핑몰 정산
            </Link>
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
      </div>
    </header>
  )
}
