'use client'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils'
import type { DateRange } from '@/lib/queries/orders'

type Props = {
  brandId: string
  malls: string[]
  activeMall: string
  range: DateRange
}

function buildHref(brandId: string, mall: string, range: DateRange): string {
  const q = new URLSearchParams({ mall, from: range.from, to: range.to })
  return `/brands/${brandId}/orders?${q.toString()}`
}

export function MallTabs({ brandId, malls, activeMall, range }: Props) {
  const items = ['all', ...malls]
  return (
    <div className="flex flex-wrap gap-2 border-b pb-2">
      {items.map((m) => {
        const active = m === activeMall
        return (
          <Link
            key={m}
            href={buildHref(brandId, m, range) as Route}
            className={cn(
              'rounded-md border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-foreground bg-foreground text-background font-medium'
                : 'border-input bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {m === 'all' ? '전체' : m}
          </Link>
        )
      })}
    </div>
  )
}
