'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAdGroups, type AdGroupRow } from '@/lib/queries/products'

type Mapping = {
  id: string
  adGroupId: string
  categoryId: string
  categoryName: string
}
type MappingsResponse = {
  mappings: Mapping[]
  categories: { id: string; name: string }[]
}

async function fetchMappings(brandId: string): Promise<MappingsResponse> {
  const r = await fetch(`/api/brands/${brandId}/ad-group-mappings`)
  if (!r.ok) throw new Error('매핑 조회 실패')
  return r.json()
}

const ROW_LIMIT = 100

export function AdMatchingTab({
  brandId,
  channel,
}: {
  brandId: string
  channel: 'cafe24' | 'smartstore' | null
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [query, setQuery] = useState('')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [unmappedOnly, setUnmappedOnly] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const groups = useSWR(['ad-groups', brandId], () => getAdGroups(supabase, brandId))
  const mappings = useSWR(['ad-group-mappings', brandId], () => fetchMappings(brandId))

  const groupsData = groups.data ?? []
  const mappingsData = mappings.data?.mappings ?? []
  const categories = mappings.data?.categories ?? []

  const mappingByGroupId = useMemo(() => {
    const m = new Map<string, Mapping>()
    for (const mp of mappingsData) m.set(mp.adGroupId, mp)
    return m
  }, [mappingsData])

  const campaigns = useMemo(() => {
    const s = new Map<string, string>()
    for (const g of groupsData) {
      if (g.campaignId && g.campaignName) s.set(g.campaignId, g.campaignName)
    }
    return Array.from(s.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [groupsData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groupsData.filter((g) => {
      const isMapped = mappingByGroupId.has(g.adGroupId)
      if (unmappedOnly && isMapped) return false
      if (campaignFilter !== 'all' && g.campaignId !== campaignFilter) return false
      if (q !== '') {
        const hay = `${g.adGroupName} ${g.campaignName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [groupsData, mappingByGroupId, unmappedOnly, campaignFilter, query])

  const visible = filtered.slice(0, ROW_LIMIT)
  const totalGroups = groupsData.length
  const mappedCount = mappingsData.length
  const unmappedCount = Math.max(0, totalGroups - mappedCount)

  async function assign(row: AdGroupRow, categoryId: string) {
    if (!categoryId) return
    setSavingId(row.adGroupId)
    try {
      const res = await fetch(`/api/brands/${brandId}/ad-group-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_group_id: row.adGroupId, category_id: categoryId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? '저장 실패')
        return
      }
      await mappings.mutate()
      router.refresh()
    } finally {
      setSavingId(null)
    }
  }

  async function remove(row: AdGroupRow) {
    const mp = mappingByGroupId.get(row.adGroupId)
    if (!mp) return
    if (!confirm(`${row.adGroupName} 매핑을 해제할까요?`)) return
    setSavingId(row.adGroupId)
    try {
      const res = await fetch(`/api/brands/${brandId}/ad-group-mappings/${mp.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? '해제 실패')
        return
      }
      await mappings.mutate()
      router.refresh()
    } finally {
      setSavingId(null)
    }
  }

  if (channel !== 'cafe24') {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          🛠 광고매칭은 카페24 스토어에서만 사용합니다. 광고비는 브랜드 단위로 집계되며,
          상품구분이 카페24 매핑 기준이라 스마트스토어 탭에서는 노출하지 않습니다.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        💡 네이버광고 <b>광고그룹</b>과 <b>상품구분</b>을 연결하면 결산조회에서 상품구분별 광고비가 계산됩니다.
        상품구분은 광고그룹 하나에 하나만 지정 (동일 카테고리에 여러 광고그룹 매핑은 OK).
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              광고매칭 · 총 광고그룹 {totalGroups}개 · 매칭 {mappedCount} · 미매칭 {unmappedCount}
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="all">캠페인 전체</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="광고그룹 / 캠페인 검색"
              className="rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={unmappedOnly}
                onChange={(e) => setUnmappedOnly(e.target.checked)}
              />
              미매칭만
            </label>
            <span className="text-xs text-muted-foreground">
              {filtered.length > ROW_LIMIT
                ? `${filtered.length}개 중 상위 ${ROW_LIMIT}개 표시`
                : `${filtered.length}개`}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {(groups.isLoading || mappings.isLoading) && (
            <div className="py-4 text-center text-sm text-muted-foreground">불러오는 중...</div>
          )}
          {!(groups.isLoading || mappings.isLoading) && (
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">캠페인</th>
                    <th className="py-2 pr-4">광고그룹</th>
                    <th className="whitespace-nowrap py-2 pr-4 text-right">키워드</th>
                    <th className="py-2 pr-4">상품구분 지정</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-foreground">
                        {unmappedOnly ? '✅ 모든 광고그룹이 매칭되어 있습니다.' : '광고그룹 없음'}
                      </td>
                    </tr>
                  )}
                  {visible.map((g) => {
                    const mp = mappingByGroupId.get(g.adGroupId)
                    return (
                      <tr key={g.adGroupId} className="border-b">
                        <td className="py-2 pr-4">{g.campaignName || '(캠페인 미상)'}</td>
                        <td className="py-2 pr-4 font-medium">{g.adGroupName || g.adGroupId}</td>
                        <td className="whitespace-nowrap py-2 pr-4 text-right">{g.keywordCount}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={mp?.categoryId ?? ''}
                              disabled={savingId === g.adGroupId}
                              onChange={(e) => assign(g, e.target.value)}
                            >
                              <option value="">
                                {savingId === g.adGroupId ? '저장 중...' : '선택하세요'}
                              </option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            {mp && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-red-700"
                                onClick={() => remove(g)}
                                disabled={savingId === g.adGroupId}
                              >
                                해제
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
