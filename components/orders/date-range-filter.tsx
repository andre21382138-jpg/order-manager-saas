'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { DateRange } from '@/lib/queries/orders'

const PRESETS = ['어제', '7일', '당월', '전월'] as const
type Preset = (typeof PRESETS)[number]

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function presetRange(p: Preset): DateRange {
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

type Props = {
  brandId: string
  mall: string
  value: DateRange
}

export function DateRangeFilter({ brandId, mall, value }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(value.from)
  const [to, setTo] = useState(value.to)

  useEffect(() => {
    setFrom(value.from)
    setTo(value.to)
  }, [value.from, value.to])

  function navigate(r: DateRange) {
    const q = new URLSearchParams({ mall, from: r.from, to: r.to })
    router.push(`/brands/${brandId}/orders?${q.toString()}`)
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
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <span className="text-sm text-muted-foreground">~</span>
      <input
        type="date"
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
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
