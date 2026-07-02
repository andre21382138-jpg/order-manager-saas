'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import { getSettlementReport, type DateRange } from '@/lib/queries/reports'
import { SettlementTable } from './settlement-table'
import { AdGroupDetailModal } from './ad-group-detail-modal'

export type Store = {
  channel: 'cafe24' | 'smartstore'
  channelAccount: string
}

type Props = {
  brandId: string
  stores: Store[]
  activeMall: string
  range: DateRange
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function DateFilter({
  brandId,
  activeMall,
  value,
}: {
  brandId: string
  activeMall: string
  value: DateRange
}) {
  const [from, setFrom] = useState(value.from)
  const [to, setTo] = useState(value.to)
  const applyHref = `/brands/${brandId}/reports?mall=${encodeURIComponent(activeMall)}&from=${from}&to=${to}` as Route
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <span className="text-sm text-muted-foreground">~</span>
      <input
        type="date"
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <Link
        href={applyHref}
        className="rounded-md border border-input bg-foreground px-3 py-1 text-sm text-background hover:opacity-80"
      >
        적용
      </Link>
    </div>
  )
}

export function ReportsClient({ brandId, stores, activeMall, range }: Props) {
  const supabase = createBrowserClient()
  const [detailCategory, setDetailCategory] = useState<{ id: string; name: string } | null>(null)

  const settlement = useSWR(
    ['settlement', brandId, activeMall, range.from, range.to],
    () => getSettlementReport(supabase, brandId, activeMall, range)
  )

  const storeTabs: Array<{ mall: string; label: string; channel: string | null }> = [
    { mall: 'all', label: '전체', channel: null },
    ...stores.map((s) => ({
      mall: s.channelAccount,
      label: s.channelAccount,
      channel: s.channel,
    })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 border-b pb-2">
          {storeTabs.map((s) => {
            const active = s.mall === activeMall
            const href = `/brands/${brandId}/reports?mall=${encodeURIComponent(s.mall)}&from=${range.from}&to=${range.to}` as Route
            return (
              <Link
                key={s.mall}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background font-medium'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                <span>{s.label}</span>
                {s.channel && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs',
                      active
                        ? 'bg-background/20 text-background'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {s.channel === 'cafe24' ? '카페24' : '스마트스토어'}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
        <DateFilter brandId={brandId} activeMall={activeMall} value={range} />
      </div>

      <SettlementTable
        rows={settlement.data ?? []}
        isLoading={settlement.isLoading}
        onDetailClick={(id, name) => setDetailCategory({ id, name })}
      />

      {detailCategory && (
        <AdGroupDetailModal
          brandId={brandId}
          categoryId={detailCategory.id}
          categoryName={detailCategory.name}
          range={range}
          onClose={() => setDetailCategory(null)}
        />
      )}
    </div>
  )
}

export { ymd }
