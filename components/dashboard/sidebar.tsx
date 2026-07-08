'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3,
  Megaphone,
  Package,
  Settings,
  Menu,
  FileText,
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
  href: string
  label: string
  icon: typeof BarChart3
}

type MenuGroup = {
  title: string
  items: MenuItem[]
}

const GROUPS: MenuGroup[] = [
  {
    title: '분석',
    items: [
      { href: '/orders', label: '매출조회', icon: BarChart3 },
      { href: '/ad-stats', label: '광고조회', icon: Megaphone },
      { href: '/reports', label: '결산조회', icon: FileText },
    ],
  },
  {
    title: '관리',
    items: [
      { href: '/products', label: '상품설정', icon: Package },
      { href: '/settings/connections', label: 'API 연동', icon: Settings },
    ],
  },
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
    <nav className="space-y-6">
      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {g.title}
          </p>
          {g.items.map((m) => {
            const href = `${base}${m.href}`
            const Icon = m.icon
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={m.label}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all',
                  active
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-foreground hover:bg-slate-200/70'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-x-1 -translate-y-1/2 rounded-r bg-foreground" />
                )}
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform',
                    active ? '' : 'text-muted-foreground group-hover:scale-110'
                  )}
                />
                <span className="font-medium">{m.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function Sidebar({ brandId }: { brandId: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:block w-[240px] shrink-0 border-r-2 border-slate-200 bg-slate-100 shadow-[inset_-4px_0_8px_-8px_rgba(15,23,42,0.15)]">
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
          <SheetContent side="left" className="w-[260px] p-4">
            <SheetTitle className="sr-only">메뉴</SheetTitle>
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
