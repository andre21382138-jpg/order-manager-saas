'use client'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SettlementRow } from '@/lib/queries/reports'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}

type Props = {
  rows: SettlementRow[]
  isLoading: boolean
  onDetailClick: (categoryId: string, categoryName: string) => void
}

export function SettlementTable({ rows, isLoading, onDetailClick }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.categoryName.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        (r.optionValue ?? '').toLowerCase().includes(q)
    )
  }, [rows, query])

  // 같은 상품구분 그룹 내 첫 행 판별 + rowspan 계산
  const { isFirstInCategory, rowspanByFirst } = useMemo(() => {
    const isFirst: boolean[] = []
    const counts = new Map<number, number>()  // firstIdx → 그룹 rowspan
    let curFirstIdx = -1
    let curKey: string | null = null
    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i]
      if (r.isUnmappedAdRow) {
        isFirst.push(true)
        curFirstIdx = -1
        curKey = null
        continue
      }
      const key = r.categoryId ?? '__unmapped__'
      if (key !== curKey) {
        isFirst.push(true)
        curFirstIdx = i
        curKey = key
        counts.set(curFirstIdx, 1)
      } else {
        isFirst.push(false)
        if (curFirstIdx >= 0) counts.set(curFirstIdx, (counts.get(curFirstIdx) ?? 1) + 1)
      }
    }
    return { isFirstInCategory: isFirst, rowspanByFirst: counts }
  }, [filtered])

  const totalRevenue = useMemo(() => {
    const seen = new Set<string>()
    let total = 0
    for (const r of filtered) {
      const key = r.categoryId ?? '__unmapped__'
      if (seen.has(key)) continue
      seen.add(key)
      total += r.catTotalAmount
    }
    return total
  }, [filtered])

  const totalAdCost = useMemo(() => {
    const seen = new Set<string>()
    let total = 0
    for (const r of filtered) {
      const key = r.categoryId ?? '__unmapped__'
      if (seen.has(key)) continue
      seen.add(key)
      total += r.catTotalAdCost
    }
    return total
  }, [filtered])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            결산조회 · {filtered.length}행 · 총 매출 <b>{fmtWon(totalRevenue)}</b> · 총 광고비 <b>{fmtWon(totalAdCost)}</b>
          </CardTitle>
          <input
            type="search"
            placeholder="상품구분 / 상품명 / 옵션 검색"
            className="rounded-md border border-input bg-background px-3 py-1 text-sm w-72"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
        )}
        {!isLoading && (
          <div className="max-h-[75vh] overflow-y-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-40" />
                <col style={{ width: '30%' }} />
                <col style={{ width: '22%' }} />
                <col className="w-24 text-right" />
                <col className="w-28 text-right" />
                <col className="w-28 text-right" />
                <col className="w-28 text-right" />
                <col className="w-24 text-center" />
              </colgroup>
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">상품구분</th>
                  <th className="py-2 pr-4">상품명</th>
                  <th className="py-2 pr-4">옵션</th>
                  <th className="py-2 pr-4 text-right">판매수량</th>
                  <th className="py-2 pr-4 text-right">매출액</th>
                  <th className="py-2 pr-4 text-right">총 매출액</th>
                  <th className="py-2 pr-4 text-right">총 광고비</th>
                  <th className="py-2 pr-4 text-center">광고 세부</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-muted-foreground">데이터 없음</td>
                  </tr>
                )}
                {filtered.map((r, idx) => {
                  const first = isFirstInCategory[idx]
                  const canDetail = first && !r.isUnmappedAdRow && r.categoryId !== null
                  if (r.isUnmappedAdRow) {
                    return (
                      <tr key={`unmapped-ad-${idx}`} className="border-b bg-amber-50">
                        <td className="py-2 pr-4 font-medium break-words text-amber-900" colSpan={6}>
                          {r.categoryName} — 매핑되지 않은 광고그룹/캠페인 비용 (광고매칭 완료 시 각 카테고리로 이동)
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-right font-medium text-amber-900">
                          {fmtWon(r.catTotalAdCost)}
                        </td>
                        <td></td>
                      </tr>
                    )
                  }
                  const rowspan = first ? (rowspanByFirst.get(idx) ?? 1) : 0
                  return (
                    <tr
                      key={`${r.categoryId ?? '_'}-${r.productNo ?? ''}-${r.optionValue ?? ''}-${idx}`}
                      className="border-b align-top"
                    >
                      {first && (
                        <td
                          rowSpan={rowspan}
                          className="border-r py-2 pr-4 font-medium break-words align-middle bg-muted/20"
                        >
                          {r.categoryName}
                          {r.categoryId === null && (
                            <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800">⚠️</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-4 break-words">{r.productName}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground break-words">{r.optionValue ?? '-'}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.qty)}개</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.amount)}</td>
                      {first && (
                        <td
                          rowSpan={rowspan}
                          className="border-l whitespace-nowrap py-2 pr-4 text-right font-medium align-middle bg-muted/20"
                        >
                          {fmtWon(r.catTotalAmount)}
                        </td>
                      )}
                      {first && (
                        <td
                          rowSpan={rowspan}
                          className="whitespace-nowrap py-2 pr-4 text-right font-medium align-middle bg-muted/20"
                        >
                          {fmtWon(r.catTotalAdCost)}
                        </td>
                      )}
                      {first && (
                        <td
                          rowSpan={rowspan}
                          className="whitespace-nowrap py-2 pr-4 text-center align-middle bg-muted/20"
                        >
                          {canDetail && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDetailClick(r.categoryId as string, r.categoryName)}
                            >
                              상세보기
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
