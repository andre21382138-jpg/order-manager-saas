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
  LayoutDashboard,
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
  desc: string
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
      { href: '/orders', label: '매출조회', desc: '기간 매출·주문·전환', icon: BarChart3 },
      { href: '/ad-stats', label: '광고조회', desc: '캠페인·키워드 성과', icon: Megaphone },
      { href: '/reports', label: '결산조회', desc: '상품구분 정산', icon: FileText },
    ],
  },
  {
    title: '관리',
    items: [
      { href: '/products', label: '상품설정', desc: '상품·구분·매칭', icon: Package },
      { href: '/settings/connections', label: 'API 연동', desc: '쇼핑몰·광고 계정', icon: Settings },
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
                  'group relative flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all',
                  active
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-foreground hover:bg-muted/70'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-x-1 -translate-y-1/2 rounded-r bg-foreground" />
                )}
                <Icon
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 transition-transform',
                    active ? '' : 'text-muted-foreground group-hover:scale-110'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className={cn('font-medium leading-tight', !active && 'text-foreground')}>
                    {m.label}
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 text-[10.5px] leading-tight',
                      active ? 'text-background/70' : 'text-muted-foreground'
                    )}
                  >
                    {m.desc}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SidebarHeader() {
  return (
    <div className="mb-4 flex items-center gap-2 px-2 py-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
        <LayoutDashboard className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight">쇼핑몰 정산</div>
        <div className="text-[10px] leading-tight text-muted-foreground">Order Manager</div>
      </div>
    </div>
  )
}

export function Sidebar({ brandId }: { brandId: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:block w-[240px] shrink-0 border-r bg-gradient-to-b from-background to-muted/30">
        <div className="sticky top-0 p-4">
          <SidebarHeader />
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
            <SidebarHeader />
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
