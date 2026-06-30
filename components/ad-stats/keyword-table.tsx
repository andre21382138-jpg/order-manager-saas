'use client'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { KeywordRow, CampaignRow } from '@/lib/queries/ad-stats'

type SortKey = 'cost' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'conversions' | 'conversion_revenue' | 'roas'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function derived(r: KeywordRow): Record<SortKey, number> {
  return {
    cost: r.cost,
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.impressions === 0 ? 0 : (r.clicks / r.impressions) * 100,
    cpc: r.clicks === 0 ? 0 : r.cost / r.clicks,
    conversions: r.conversions,
    conversion_revenue: r.conversion_revenue,
    roas: r.cost === 0 ? 0 : (r.conversion_revenue / r.cost) * 100,
  }
}

export function KeywordTable({
  data,
  campaigns,
  isLoading,
  onRowClick,
}: {
  data: KeywordRow[]
  campaigns: CampaignRow[]
  isLoading: boolean
  onRowClick: (unit: { id: string; name: string }) => void
}) {
  const [query, setQuery] = useState('')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'cost', dir: 'desc' })

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return data.filter(
      (r) =>
        (campaignFilter === 'all' || r.campaign_id === campaignFilter) &&
        (q === '' || r.keyword_name.toLowerCase().includes(q))
    )
  }, [data, query, campaignFilter])

  const sorted = useMemo(() => {
    const dArr = filtered.slice()
    dArr.sort((a, b) => {
      const av = derived(a)[sort.key]
      const bv = derived(b)[sort.key]
      return sort.dir === 'asc' ? av - bv : bv - av
    })
    return dArr
  }, [filtered, sort])

  function toggleSort(k: SortKey) {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' }))
  }

  function header(label: string, k: SortKey) {
    const arrow = sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
    return (
      <th
        className="cursor-pointer py-2 pr-4 text-right hover:underline"
        onClick={() => toggleSort(k)}
      >
        {label}
        {arrow}
      </th>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔑 키워드별 광고 성과</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
          >
            <option value="all">캠페인 전체</option>
            {campaigns
              .slice()
              .sort((a, b) => a.campaign_name.localeCompare(b.campaign_name))
              .map((c) => (
                <option key={c.ad_unit_id} value={c.campaign_id}>
                  {c.campaign_name}
                </option>
              ))}
          </select>
          <input
            type="search"
            placeholder="키워드 검색"
            className="rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">{sorted.length}개</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">키워드</th>
                <th className="py-2 pr-4">캠페인</th>
                <th className="py-2 pr-4">광고그룹</th>
                {header('광고비', 'cost')}
                {header('노출', 'impressions')}
                {header('클릭', 'clicks')}
                {header('CTR', 'ctr')}
                {header('CPC', 'cpc')}
                {header('전환수', 'conversions')}
                {header('전환매출', 'conversion_revenue')}
                {header('ROAS', 'roas')}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="py-4 text-center text-muted-foreground">
                    로딩 중...
                  </td>
                </tr>
              )}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-4 text-center text-muted-foreground">
                    데이터 없음
                  </td>
                </tr>
              )}
              {sorted.map((r) => {
                const d = derived(r)
                return (
                  <tr
                    key={r.ad_unit_id}
                    className="cursor-pointer border-b hover:bg-muted/40"
                    onClick={() => onRowClick({ id: r.ad_unit_id, name: r.keyword_name })}
                  >
                    <td className="py-2 pr-4 font-medium">{r.keyword_name}</td>
                    <td className="py-2 pr-4">{r.campaign_name}</td>
                    <td className="py-2 pr-4">{r.ad_group_name}</td>
                    <td className="py-2 pr-4 text-right">₩{fmt(r.cost)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.impressions)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.clicks)}</td>
                    <td className="py-2 pr-4 text-right">{d.ctr === 0 && r.impressions === 0 ? '—' : `${d.ctr.toFixed(2)}%`}</td>
                    <td className="py-2 pr-4 text-right">{d.cpc === 0 && r.clicks === 0 ? '—' : `₩${Math.round(d.cpc).toLocaleString('ko-KR')}`}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.conversions)}</td>
                    <td className="py-2 pr-4 text-right">₩{fmt(r.conversion_revenue)}</td>
                    <td className="py-2 pr-4 text-right">{d.roas === 0 && r.cost === 0 ? '—' : `${d.roas.toFixed(0)}%`}</td>
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
