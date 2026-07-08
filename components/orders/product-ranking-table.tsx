'use client'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  const [expanded, setExpanded] = useState(false)

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

  const visibleRows = expanded ? rows : rows.slice(0, 10)
  const hiddenCount = rows.length - visibleRows.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          🏆 상품 판매 순위 {expanded ? `(총 ${rows.length}개)` : '(Top 10)'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">상품명</th>
                <th className="py-2 pr-4">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="min-w-[3.5rem] text-right">
                      <SortLabel active={sortKey === 'qty'} dir={sortDir} onClick={() => toggle('qty')}>
                        판매수량
                      </SortLabel>
                    </span>
                    <span className="min-w-[4.5rem] text-left">
                      <SortLabel
                        active={sortKey === 'prev_qty'}
                        dir={sortDir}
                        onClick={() => toggle('prev_qty')}
                        className="text-xs"
                      >
                        (전월)
                      </SortLabel>
                    </span>
                  </div>
                </th>
                <th className="py-2 pr-4">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="min-w-[6rem] text-right">
                      <SortLabel
                        active={sortKey === 'amount'}
                        dir={sortDir}
                        onClick={() => toggle('amount')}
                      >
                        매출액
                      </SortLabel>
                    </span>
                    <span className="min-w-[7rem] text-left">
                      <SortLabel
                        active={sortKey === 'prev_amount'}
                        dir={sortDir}
                        onClick={() => toggle('prev_amount')}
                        className="text-xs"
                      >
                        (전월)
                      </SortLabel>
                    </span>
                  </div>
                </th>
                <th className="py-2 pr-4">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="min-w-[3.5rem] text-right">
                      <SortLabel
                        active={sortKey === 'share'}
                        dir={sortDir}
                        onClick={() => toggle('share')}
                      >
                        비중
                      </SortLabel>
                    </span>
                    <span className="min-w-[4rem] text-left">
                      <SortLabel
                        active={sortKey === 'prev_share'}
                        dir={sortDir}
                        onClick={() => toggle('prev_share')}
                        className="text-xs"
                      >
                        (전월)
                      </SortLabel>
                    </span>
                  </div>
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
              {visibleRows.map((r, i) => {
                const prevQty = r.prev_qty !== null ? `${r.prev_qty.toLocaleString('ko-KR')}개` : '(-)'
                const prevAmt = r.prev_amount !== null ? fmtWon(r.prev_amount) : '(-)'
                const prevShare = r.prev_share !== null ? `${r.prev_share.toFixed(1)}%` : '(-)'
                return (
                  <tr key={`${r.product_name}-${i}`} className="border-b">
                    <td className="py-2 pr-4 font-medium">{i + 1}</td>
                    <td className="py-2 pr-4">{r.product_name}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      <div className="flex items-baseline justify-end gap-2">
                        <span className="min-w-[3.5rem] text-right">
                          {r.qty.toLocaleString('ko-KR')}개
                        </span>
                        <span className="min-w-[4.5rem] text-left text-xs text-muted-foreground">
                          {r.prev_qty !== null ? `(${prevQty})` : '(-)'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      <div className="flex items-baseline justify-end gap-2">
                        <span className="min-w-[6rem] text-right">{fmtWon(r.amount)}</span>
                        <span className="min-w-[7rem] text-left text-xs text-muted-foreground">
                          {r.prev_amount !== null ? `(${prevAmt})` : '(-)'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      <div className="flex items-baseline justify-end gap-2">
                        <span className="min-w-[3.5rem] text-right">{r.share.toFixed(1)}%</span>
                        <span className="min-w-[4rem] text-left text-xs text-muted-foreground">
                          {r.prev_share !== null ? `(${prevShare})` : '(-)'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 10 && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '접기' : `더보기 (+${hiddenCount}개)`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
