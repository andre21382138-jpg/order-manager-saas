'use client'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProductRow } from '@/lib/queries/orders'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

type SortKey = 'qty' | 'amount' | 'share' | 'prev_qty' | 'prev_amount' | 'prev_share'
type SortDir = 'asc' | 'desc'

function SortLabel({
  active,
  dir,
  onClick,
  children,
  className,
}: {
  active: boolean
  dir: SortDir
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-0.5 hover:text-foreground',
        active && 'text-foreground font-medium',
        className
      )}
    >
      {children}
      {active && <span className="text-[10px]">{dir === 'desc' ? '▼' : '▲'}</span>}
    </button>
  )
}

export function ProductRankingTable({
  data,
  prev = [],
}: {
  data: ProductRow[]
  prev?: ProductRow[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('amount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const prevByName = useMemo(() => new Map(prev.map((r) => [r.product_name, r])), [prev])

  const rows = useMemo(() => {
    const enriched = data.map((r) => {
      const p = prevByName.get(r.product_name)
      return {
        ...r,
        prev_qty: p?.qty ?? null,
        prev_amount: p?.amount ?? null,
        prev_share: p?.share ?? null,
      }
    })
    const dir = sortDir === 'desc' ? -1 : 1
    return [...enriched].sort((a, b) => {
      const va = (a[sortKey] ?? -Infinity) as number
      const vb = (b[sortKey] ?? -Infinity) as number
      if (va === vb) return 0
      return va > vb ? dir : -dir
    })
  }, [data, prevByName, sortKey, sortDir])

  function toggle(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">🏆 상품 판매 순위 (Top 10)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">상품명</th>
                <th className="py-2 pr-4 text-right">
                  <SortLabel active={sortKey === 'qty'} dir={sortDir} onClick={() => toggle('qty')}>
                    판매수량
                  </SortLabel>
                  <span className="mx-1">/</span>
                  <SortLabel
                    active={sortKey === 'prev_qty'}
                    dir={sortDir}
                    onClick={() => toggle('prev_qty')}
                    className="text-xs"
                  >
                    (전월)
                  </SortLabel>
                </th>
                <th className="py-2 pr-4 text-right">
                  <SortLabel
                    active={sortKey === 'amount'}
                    dir={sortDir}
                    onClick={() => toggle('amount')}
                  >
                    매출액
                  </SortLabel>
                  <span className="mx-1">/</span>
                  <SortLabel
                    active={sortKey === 'prev_amount'}
                    dir={sortDir}
                    onClick={() => toggle('prev_amount')}
                    className="text-xs"
                  >
                    (전월)
                  </SortLabel>
                </th>
                <th className="py-2 pr-4 text-right">
                  <SortLabel
                    active={sortKey === 'share'}
                    dir={sortDir}
                    onClick={() => toggle('share')}
                  >
                    비중
                  </SortLabel>
                  <span className="mx-1">/</span>
                  <SortLabel
                    active={sortKey === 'prev_share'}
                    dir={sortDir}
                    onClick={() => toggle('prev_share')}
                    className="text-xs"
                  >
                    (전월)
                  </SortLabel>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const prevQty = r.prev_qty !== null ? `${r.prev_qty.toLocaleString('ko-KR')}개` : '—'
                const prevAmt = r.prev_amount !== null ? fmtWon(r.prev_amount) : '—'
                const prevShare = r.prev_share !== null ? `${r.prev_share.toFixed(1)}%` : '—'
                return (
                  <tr key={`${r.product_name}-${i}`} className="border-b">
                    <td className="py-2 pr-4 font-medium">{i + 1}</td>
                    <td className="py-2 pr-4">{r.product_name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.qty.toLocaleString('ko-KR')}개
                      <span className="ml-1 text-xs text-muted-foreground">({prevQty})</span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtWon(r.amount)}
                      <span className="ml-1 text-xs text-muted-foreground">({prevAmt})</span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.share.toFixed(1)}%
                      <span className="ml-1 text-xs text-muted-foreground">({prevShare})</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
