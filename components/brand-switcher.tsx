'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

type Brand = {
  id: string
  name: string
  color: string | null
}

export function BrandSwitcher({
  currentBrandId,
  brands,
}: {
  currentBrandId: string | null
  brands: Brand[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  const current = brands.find((b) => b.id === currentBrandId)

  function switchTo(brandId: string) {
    if (!currentBrandId) {
      router.push(`/brands/${brandId}`)
      return
    }
    // /brands/{currentBrandId}/... → /brands/{brandId}/...
    const next = pathname.replace(`/brands/${currentBrandId}`, `/brands/${brandId}`)
    router.push(next)
  }

  if (brands.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm" className="gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: current?.color ?? '#94a3b8' }}
          />
          <span>{current ? current.name : '브랜드 선택'}</span>
          <span className="text-xs text-muted-foreground">▼</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {brands.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => switchTo(b.id)}
            className="gap-2"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: b.color ?? '#94a3b8' }}
            />
            <span className="flex-1">{b.name}</span>
            {b.id === currentBrandId && <span>✓</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/brands/new')}>
          + 브랜드 추가
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
