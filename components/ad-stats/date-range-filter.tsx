'use client'
import { Button } from '@/components/ui/button'
import type { DateRange } from '@/lib/queries/ad-stats'

const PRESETS = ['어제', '7일', '당월', '전월'] as const
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
  if (p === '어제') return { from: ymd(yesterday), to: ymd(yesterday) }
  if (p === '7일') return { from: ymd(new Date(yesterday.getTime() - 6 * 86400000)), to: ymd(yesterday) }
  if (p === '당월') return { from: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to: ymd(yesterday) }
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const lastOfPrev = new Date(firstOfThisMonth.getTime() - 86400000)
  const firstOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1))
  return { from: ymd(firstOfPrev), to: ymd(lastOfPrev) }
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (r: DateRange) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['어제', '7일', '당월', '전월'] as Preset[]).map((p) => (
        <Button key={p} variant="outline" size="sm" onClick={() => onChange(presetRange(p))}>
          {p}
        </Button>
      ))}
      <input
        type="date"
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
      />
      <span className="text-sm text-muted-foreground">~</span>
      <input
        type="date"
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
      />
    </div>
  )
}

export function defaultRange(): DateRange {
  return presetRange('당월')
}
