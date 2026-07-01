'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  productId: string
  initialCost: number | null
}

function fmtWon(n: number | null): string {
  if (n === null) return '-'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function ProductCostEditor({ productId, initialCost }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialCost === null ? '' : String(Math.round(initialCost)))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function save() {
    setError(null)
    const trimmed = value.trim()
    let cost: number | null = null
    if (trimmed !== '') {
      const num = Number(trimmed.replace(/,/g, ''))
      if (Number.isNaN(num) || num < 0) {
        setError('숫자 입력')
        return
      }
      cost = num
    }
    const res = await fetch(`/api/catalog-products/${productId}/update-cost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: '실패' }))
      setError(j.error ?? '저장 실패')
      return
    }
    setEditing(false)
    startTransition(() => router.refresh())
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setValue(initialCost === null ? '' : String(Math.round(initialCost)))
              setError(null)
              setEditing(false)
            }
          }}
          onBlur={save}
          disabled={isPending}
          className="w-24 rounded-md border border-input bg-background px-2 py-0.5 text-right text-sm"
          placeholder="원가"
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded px-2 py-0.5 text-right text-sm hover:bg-muted"
    >
      {fmtWon(initialCost)}
    </button>
  )
}
