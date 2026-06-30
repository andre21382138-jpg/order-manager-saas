'use client'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CampaignRow } from '@/lib/queries/ad-stats'

const TYPE_LABEL: Record<string, string> = {
  WEB_SITE: '파워링크',
  SHOPPING: '쇼핑검색',
  POWER_CONTENTS: '파워컨텐츠',
  BRAND_SEARCH: '브랜드검색',
  BRAND_SEARCH_ADS: '브랜드검색ADS',
  PLACE: '플레이스',
  unknown: '미분류',
}

type SortKey = 'cost' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'conversions' | 'conversion_revenue' | 'roas'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function derived(r: CampaignRow): Record<SortKey, number> {
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

export function CampaignTable({
  data,
  isLoading,
  onRowClick,
}: {
  data: CampaignRow[]
  isLoading: boolean
  onRowClick: (unit: { id: string; name: string }) => void
}) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'cost', dir: 'desc' })

  const allTypes = useMemo(() => {
    const s = new Set<string>()
    for (const r of data) s.add(r.campaign_type)
    return Array.from(s).sort()
  }, [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return data.filter(
      (r) =>
        (typeFilter === 'all' || r.campaign_type === typeFilter) &&
        (q === '' || r.campaign_name.toLowerCase().includes(q))
    )
  }, [data, query, typeFilter])

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
        <CardTitle>캠페인별 광고 성과</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">광고영역 전체</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="캠페인 검색"
            className="rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">캠페인</th>
                <th className="py-2 pr-4">광고영역</th>
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
                  <td colSpan={10} className="py-4 text-center text-muted-foreground">
                    로딩 중...
                  </td>
                </tr>
              )}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 text-center text-muted-foreground">
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
                    onClick={() => onRowClick({ id: r.ad_unit_id, name: r.campaign_name })}
                  >
                    <td className="py-2 pr-4 font-medium">{r.campaign_name}</td>
                    <td className="py-2 pr-4">{TYPE_LABEL[r.campaign_type] ?? r.campaign_type}</td>
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
