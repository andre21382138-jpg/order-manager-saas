'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Home,
  BarChart3,
  Megaphone,
  Package,
  Settings,
  Menu,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MenuItem = {
  href: string // brand 상대 경로 ('' 또는 '/ad-stats' 등)
  label: string
  icon: typeof Home
}

const MENUS: MenuItem[] = [
  { href: '', label: '홈', icon: Home },
  { href: '/orders', label: '매출', icon: BarChart3 },
  { href: '/ad-stats', label: '광고', icon: Megaphone },
  { href: '/products', label: '상품', icon: Package },
  { href: '/settings/connections', label: '설정', icon: Settings },
]

function MenuList({
  brandId,
  pathname,
  onNavigate,
}: {
  brandId: string
  pathname: string
  onNavigate?: () => void
}) {
  const base = `/brands/${brandId}`
  return (
    <nav className="space-y-1">
      {MENUS.map((m) => {
        const href = `${base}${m.href}`
        const Icon = m.icon
        const active =
          m.href === ''
            ? pathname === base || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={m.label}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-foreground text-background font-medium'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{m.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ brandId }: { brandId: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:block w-[220px] shrink-0 border-r bg-background">
        <div className="sticky top-0 p-4">
          <MenuList brandId={brandId} pathname={pathname} />
        </div>
      </aside>

      {/* 모바일 햄버거 트리거 + Sheet */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="sm" className="fixed top-3 left-3 z-40">
                <Menu className="h-5 w-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-[240px] p-4">
            <SheetTitle className="mb-4 text-base">메뉴</SheetTitle>
            <MenuList
              brandId={brandId}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
