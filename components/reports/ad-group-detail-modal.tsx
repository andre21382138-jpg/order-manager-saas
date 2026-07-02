'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createBrowserClient } from '@/lib/supabase/client'
import { getCategoryKeywordDetails, type DateRange } from '@/lib/queries/reports'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  WEB_SITE: '파워링크',
  SHOPPING: '쇼핑검색',
  POWER_CONTENTS: '파워컨텐츠',
  BRAND_SEARCH: '브랜드검색',
  BRAND_SEARCH_ADS: '브랜드검색ADS',
  PLACE: '플레이스',
}

const ROW_LIMIT = 500

export function AdGroupDetailModal({
  brandId,
  categoryId,
  categoryName,
  range,
  onClose,
}: {
  brandId: string
  categoryId: string
  categoryName: string
  range: DateRange
  onClose: () => void
}) {
  const supabase = createBrowserClient()
  const [query, setQuery] = useState('')

  const details = useSWR(
    ['kw-details', brandId, categoryId, range.from, range.to],
    () => getCategoryKeywordDetails(supabase, brandId, categoryId, range)
  )

  const rows = details.data ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.adGroupName.toLowerCase().includes(q) ||
        r.campaignName.toLowerCase().includes(q) ||
        r.keywordName.toLowerCase().includes(q)
    )
  }, [rows, query])

  const visible = filtered.slice(0, ROW_LIMIT)

  const totalCost = filtered.reduce((s, r) => s + r.cost, 0)
  const totalImpressions = filtered.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = filtered.reduce((s, r) => s + r.clicks, 0)
  const totalConversions = filtered.reduce((s, r) => s + r.conversions, 0)
  const totalConversionRevenue = filtered.reduce((s, r) => s + r.conversionRevenue, 0)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="!max-w-[min(97vw,1200px)] w-full">
        <DialogHeader>
          <DialogTitle>{categoryName} — 키워드별 광고 세부내역</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs md:grid-cols-5">
            <div><span className="text-muted-foreground">총 광고비</span><br /><b>{fmtWon(totalCost)}</b></div>
            <div><span className="text-muted-foreground">노출</span><br /><b>{fmtCount(totalImpressions)}</b></div>
            <div><span className="text-muted-foreground">클릭</span><br /><b>{fmtCount(totalClicks)}</b></div>
            <div><span className="text-muted-foreground">전환수</span><br /><b>{fmtCount(totalConversions)}</b></div>
            <div><span className="text-muted-foreground">전환매출</span><br /><b>{fmtWon(totalConversionRevenue)}</b></div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="search"
              placeholder="광고그룹 / 캠페인 / 키워드 검색"
              className="rounded-md border border-input bg-background px-3 py-1 text-sm w-72"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {filtered.length > ROW_LIMIT
                ? `${filtered.length}건 중 상위 ${ROW_LIMIT}건 표시`
                : `총 ${filtered.length}건`}
              {' · '}
              <span className="text-amber-700">
                ⚠️ 키워드 없는 캠페인(쇼핑광고 등)은 여기 표시되지 않음
              </span>
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">광고그룹</th>
                  <th className="py-2 pr-4">캠페인</th>
                  <th className="py-2 pr-4">광고영역</th>
                  <th className="py-2 pr-4">키워드</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">광고비</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">노출</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">클릭</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">CPC</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">전환수</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">전환매출</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {details.isLoading && (
                  <tr>
                    <td colSpan={11} className="py-4 text-center text-muted-foreground">불러오는 중...</td>
                  </tr>
                )}
                {!details.isLoading && visible.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-4 text-center text-muted-foreground">
                      매칭된 키워드가 없거나 기간 내 광고 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {visible.map((r) => {
                  const roas = r.cost === 0 ? 0 : (r.conversionRevenue / r.cost) * 100
                  const cpc = r.clicks === 0 ? 0 : r.cost / r.clicks
                  const areaLabel = CAMPAIGN_TYPE_LABEL[r.campaignType] ?? (r.campaignType || '-')
                  return (
                    <tr key={r.keywordUnitId} className="border-b align-top">
                      <td className="py-2 pr-4 font-medium break-words">{r.adGroupName || '-'}</td>
                      <td className="py-2 pr-4 break-words">{r.campaignName || '-'}</td>
                      <td className="py-2 pr-4">{areaLabel}</td>
                      <td className="py-2 pr-4 break-words">{r.keywordName || '-'}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.cost)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.impressions)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.clicks)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">
                        {r.clicks === 0 ? '—' : fmtWon(cpc)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.conversions)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.conversionRevenue)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">
                        {r.cost === 0 ? '—' : `${roas.toFixed(0)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
