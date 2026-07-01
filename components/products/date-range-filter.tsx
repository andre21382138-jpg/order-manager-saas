'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { DateRange } from '@/lib/queries/products'

const PRESETS = ['7일', '30일', '당월', '전월'] as const
type Preset = (typeof PRESETS)[number]

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function presetRange(p: Preset): DateRange {
  const now = kstNow()
  const yesterday = new Date(now.getTime() - 86400000)
  if (p === '7일')
    return { from: ymd(new Date(yesterday.getTime() - 6 * 86400000)), to: ymd(yesterday) }
  if (p === '30일')
    return { from: ymd(new Date(yesterday.getTime() - 29 * 86400000)), to: ymd(yesterday) }
  if (p === '당월') {
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    if (firstOfMonth.getTime() >= yesterday.getTime()) {
      return { from: ymd(new Date(yesterday.getTime() - 29 * 86400000)), to: ymd(yesterday) }
    }
    return { from: ymd(firstOfMonth), to: ymd(yesterday) }
  }
  const firstOfThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const lastOfPrev = new Date(firstOfThis.getTime() - 86400000)
  const firstOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1))
  return { from: ymd(firstOfPrev), to: ymd(lastOfPrev) }
}

type Props = {
  brandId: string
  mall: string
  value: DateRange
}

export function DateRangeFilter({ brandId, mall, value }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<DateRange>(value)

  function applyPreset(p: Preset) {
    setDraft(presetRange(p))
  }

  function submit() {
    const q = new URLSearchParams({ mall, from: draft.from, to: draft.to })
    router.push(`/brands/${brandId}/products?${q.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['7일', '30일', '당월', '전월'] as Preset[]).map((p) => (
        <Button key={p} variant="outline" size="sm" onClick={() => applyPreset(p)}>
          {p}
        </Button>
      ))}
      <input
        type="date"
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={draft.from}
        onChange={(e) => setDraft({ ...draft, from: e.target.value })}
      />
      <span className="text-sm text-muted-foreground">~</span>
      <input
        type="date"
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={draft.to}
        onChange={(e) => setDraft({ ...draft, to: e.target.value })}
      />
      <Button size="sm" onClick={submit}>
        조회
      </Button>
    </div>
  )
}
