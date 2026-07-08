'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import type { Route } from 'next'
import { Button } from '@/components/ui/button'
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

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

type Preset = '어제' | '7일' | '당월' | '전월'
function presetRange(p: Preset): DateRange {
  const now = kstNow()
  const yesterday = new Date(now.getTime() - 86400000)
  if (p === '어제') return { from: ymd(yesterday), to: ymd(yesterday) }
  if (p === '7일')
    return { from: ymd(new Date(yesterday.getTime() - 6 * 86400000)), to: ymd(yesterday) }
  if (p === '당월')
    return {
      from: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
      to: ymd(yesterday),
    }
  const firstOfThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const lastOfPrev = new Date(firstOfThis.getTime() - 86400000)
  const firstOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1))
  return { from: ymd(firstOfPrev), to: ymd(lastOfPrev) }
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
  const router = useRouter()
  const [from, setFrom] = useState(value.from)
  const [to, setTo] = useState(value.to)

  useEffect(() => {
    setFrom(value.from)
    setTo(value.to)
  }, [value.from, value.to])

  function navigate(r: DateRange) {
    router.push(
      `/brands/${brandId}/reports?mall=${encodeURIComponent(activeMall)}&from=${r.from}&to=${r.to}` as Route
    )
  }

  function applyPreset(p: Preset) {
    const r = presetRange(p)
    setFrom(r.from)
    setTo(r.to)
    navigate(r)
  }

  const dirty = from !== value.from || to !== value.to

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['어제', '7일', '당월', '전월'] as Preset[]).map((p) => (
        <Button key={p} variant="outline" size="sm" onClick={() => applyPreset(p)}>
          {p}
        </Button>
      ))}
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
      <Button
        variant={dirty ? 'default' : 'outline'}
        size="sm"
        onClick={() => navigate({ from, to })}
      >
        조회
      </Button>
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
