'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  getCategoryAdGroupDetails,
  getCategoryKeywordDetails,
  type DateRange,
} from '@/lib/queries/reports'

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

const KEYWORD_ROW_LIMIT = 500

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

  const adGroups = useSWR(
    ['ag-details', brandId, categoryId, range.from, range.to],
    () => getCategoryAdGroupDetails(supabase, brandId, categoryId, range)
  )
  const keywords = useSWR(
    ['kw-details', brandId, categoryId, range.from, range.to],
    () => getCategoryKeywordDetails(supabase, brandId, categoryId, range)
  )

  const agRows = adGroups.data ?? []
  const kwRows = keywords.data ?? []

  const kwFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return kwRows
    return kwRows.filter(
      (r) =>
        r.adGroupName.toLowerCase().includes(q) ||
        r.campaignName.toLowerCase().includes(q) ||
        r.keywordName.toLowerCase().includes(q)
    )
  }, [kwRows, query])

  const kwVisible = kwFiltered.slice(0, KEYWORD_ROW_LIMIT)

  const agTotal = agRows.reduce((s, r) => s + r.cost, 0)
  const kwTotal = kwFiltered.reduce((s, r) => s + r.cost, 0)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="!max-w-[min(97vw,1200px)] w-full">
        <DialogHeader>
          <DialogTitle>{categoryName} — 광고 세부내역</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* 광고그룹 요약 (결산조회 표의 총 광고비와 일치) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                📊 광고그룹 요약 · 총 광고비 <b>{fmtWon(agTotal)}</b>
              </h3>
              <span className="text-xs text-muted-foreground">
                캠페인 광고비를 매핑 비율로 분배 (결산조회 표와 동일 기준)
              </span>
            </div>
            <div className="max-h-[35vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">광고그룹</th>
                    <th className="py-2 pr-4">캠페인</th>
                    <th className="py-2 pr-4">광고영역</th>
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
                  {adGroups.isLoading && (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-muted-foreground">불러오는 중...</td>
                    </tr>
                  )}
                  {!adGroups.isLoading && agRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-muted-foreground">
                        매칭된 광고그룹이 없거나 광고 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                  {agRows.map((r) => {
                    const roas = r.cost === 0 ? 0 : (r.conversionRevenue / r.cost) * 100
                    const cpc = r.clicks === 0 ? 0 : r.cost / r.clicks
                    const areaLabel = CAMPAIGN_TYPE_LABEL[r.campaignType] ?? (r.campaignType || '-')
                    return (
                      <tr key={r.adGroupId} className="border-b align-top">
                        <td className="py-2 pr-4 font-medium break-words">{r.adGroupName || r.adGroupId}</td>
                        <td className="py-2 pr-4 break-words">{r.campaignName || '-'}</td>
                        <td className="py-2 pr-4">{areaLabel}</td>
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

          {/* 키워드 세부 */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                🔑 키워드 세부 · 총 광고비 <b>{fmtWon(kwTotal)}</b>
              </h3>
              <input
                type="search"
                placeholder="광고그룹 / 캠페인 / 키워드 검색"
                className="rounded-md border border-input bg-background px-3 py-1 text-sm w-64"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="mb-1 text-xs text-amber-700">
              ⚠️ 키워드 실측치만 집계. 브랜드검색·쇼핑검색 등에서 캠페인 광고비 대비 낮게 나올 수 있음.
              {kwFiltered.length > KEYWORD_ROW_LIMIT && ` · ${kwFiltered.length}건 중 상위 ${KEYWORD_ROW_LIMIT}건 표시`}
            </div>
            <div className="max-h-[35vh] overflow-y-auto rounded-md border">
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
                  {keywords.isLoading && (
                    <tr>
                      <td colSpan={11} className="py-4 text-center text-muted-foreground">불러오는 중...</td>
                    </tr>
                  )}
                  {!keywords.isLoading && kwVisible.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-4 text-center text-muted-foreground">
                        키워드 데이터 없음 (매칭된 광고그룹에 키워드가 없거나 기간 내 실적 없음).
                      </td>
                    </tr>
                  )}
                  {kwVisible.map((r) => {
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
