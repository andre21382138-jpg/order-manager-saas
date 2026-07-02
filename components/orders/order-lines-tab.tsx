'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getOrderLines, type DateRange } from '@/lib/queries/orders'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

const ROW_LIMIT = 500

export function OrderLinesTab({
  brandId,
  mall,
  range,
}: {
  brandId: string
  mall: string
  range: DateRange
}) {
  const supabase = createBrowserClient()
  const [query, setQuery] = useState('')

  const lines = useSWR(
    ['order-lines', brandId, mall, range.from, range.to],
    () => getOrderLines(supabase, brandId, mall, range)
  )

  const rows = lines.data ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.categoryName.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        (r.optionValue?.toLowerCase() ?? '').includes(q) ||
        r.orderNo.toLowerCase().includes(q)
    )
  }, [rows, query])

  const visible = filtered.slice(0, ROW_LIMIT)
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const totalQty = filtered.reduce((s, r) => s + r.qty, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            주문 라인 · {rows.length.toLocaleString('ko-KR')}건 (기간 매출 ₩{fmt(Math.round(totalAmount))} / 총 {fmt(totalQty)}개)
          </CardTitle>
          <input
            type="search"
            placeholder="상품구분 / 상품명 / 옵션 / 주문번호 검색"
            className="rounded-md border border-input bg-background px-3 py-1 text-sm w-80"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filtered.length > ROW_LIMIT && (
          <div className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString('ko-KR')}건 중 상위 {ROW_LIMIT}건 표시 — 검색으로 좁혀주세요
          </div>
        )}
      </CardHeader>
      <CardContent>
        {lines.isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
        )}
        {!lines.isLoading && (
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-24" />
                <col className="w-44" />
                <col className="w-32" />
                <col style={{ width: '30%' }} />
                <col style={{ width: '30%' }} />
                <col className="w-16" />
                <col className="w-28" />
              </colgroup>
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">주문일</th>
                  <th className="py-2 pr-4">주문번호</th>
                  <th className="py-2 pr-4">상품구분</th>
                  <th className="py-2 pr-4">상품명</th>
                  <th className="py-2 pr-4">옵션</th>
                  <th className="py-2 pr-4 text-right">수량</th>
                  <th className="py-2 pr-4 text-right">매출액</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-muted-foreground">
                      데이터 없음
                    </td>
                  </tr>
                )}
                {visible.map((r, i) => (
                  <tr key={`${r.orderNo}-${r.productNo ?? ''}-${i}`} className="border-b align-top">
                    <td className="whitespace-nowrap py-2 pr-4">{r.orderDate}</td>
                    <td className="py-2 pr-4 font-mono text-xs break-all">{r.orderNo}</td>
                    <td className="py-2 pr-4 break-words">
                      {r.categoryName}
                      {r.categoryName === '미분류' && (
                        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800">⚠️</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 break-words">{r.productName}</td>
                    <td className="py-2 pr-4 break-words text-xs text-muted-foreground">
                      {r.optionValue ?? '-'}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">{fmt(r.qty)}개</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">₩{fmt(Math.round(r.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
