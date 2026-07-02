'use client'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProductCostEditor } from './product-cost-editor'
import { MappingImportModal } from './mapping-import-modal'
import { getProductInfo, type ProductInfoRow } from '@/lib/queries/products'

type MappingItem = {
  id: string
  productName: string
  productNo: string | null
  categoryId: string
  categoryName: string
}

type Category = { id: string; name: string }

type MappingsResponse = {
  mappings: MappingItem[]
  categories: Category[]
}

async function fetchMappings(brandId: string): Promise<MappingsResponse> {
  const r = await fetch(`/api/brands/${brandId}/category-mappings`)
  if (!r.ok) throw new Error('매핑 조회 실패')
  return r.json()
}

export function MappingManager({
  brandId,
  mall,
}: {
  brandId: string
  mall: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [unmappedOnly, setUnmappedOnly] = useState(true)
  const ROW_LIMIT = 100

  const supabase = createBrowserClient()

  const mappings = useSWR(['mappings', brandId], () => fetchMappings(brandId))
  const infos = useSWR(open ? ['info', brandId, mall] : null, () =>
    getProductInfo(supabase, brandId, mall)
  )

  const costByName = useMemo(() => {
    const m = new Map<string, ProductInfoRow>()
    for (const i of infos.data ?? []) m.set(i.productName, i)
    return m
  }, [infos.data])

  const mappingByName = useMemo(() => {
    const m = new Map<string, MappingItem>()
    for (const mp of mappings.data?.mappings ?? []) m.set(mp.productName, mp)
    return m
  }, [mappings.data])

  const allNames = useMemo(() => {
    const s = new Set<string>()
    for (const i of infos.data ?? []) s.add(i.productName)
    for (const mp of mappings.data?.mappings ?? []) s.add(mp.productName)
    return Array.from(s).sort()
  }, [infos.data, mappings.data])

  const rows = useMemo(() => {
    return allNames
      .map((name) => {
        const mp = mappingByName.get(name)
        const info = costByName.get(name)
        return {
          productName: name,
          mappingId: mp?.id ?? null,
          categoryId: mp?.categoryId ?? null,
          categoryName: mp?.categoryName ?? '',
          catalogProductId: info?.catalogProductId ?? null,
          cost: info?.cost ?? null,
        }
      })
      .filter((r) => {
        if (unmappedOnly && r.categoryId !== null) return false
        if (query.trim() !== '' && !r.productName.toLowerCase().includes(query.trim().toLowerCase())) {
          return false
        }
        return true
      })
  }, [allNames, mappingByName, costByName, unmappedOnly, query])

  const totalMappings = mappings.data?.mappings.length ?? 0
  const unmappedCount = allNames.filter((n) => !mappingByName.has(n)).length
  const visibleRows = useMemo(() => rows.slice(0, ROW_LIMIT), [rows])

  async function updateCategory(mappingId: string | null, productName: string, newCategoryId: string | null) {
    // 신규 매핑이면 삭제 API 대신 무시 (미분류는 매핑 row 자체가 없으므로 아무 것도 안 함)
    if (!mappingId) {
      if (newCategoryId === null) return
      // 카테고리를 새로 할당하려면 별도 신규 매핑 필요 — 현재 스코프 밖. 안내
      alert('신규 매핑 추가는 Excel import에서 처리해 주세요')
      return
    }
    const res = await fetch(`/api/brands/${brandId}/category-mappings/${mappingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: newCategoryId }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '저장 실패')
      return
    }
    await mappings.mutate()
    router.refresh()
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="text-base">
          📌 매핑 관리 · 총 {totalMappings}건 · 미분류 {unmappedCount}건 {open ? '▼' : '▶'}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setImportOpen(true)}>Excel Import</Button>
            <input
              type="search"
              placeholder="상품명 검색"
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
              미분류만
            </label>
            <span className="text-xs text-muted-foreground">
              {rows.length > ROW_LIMIT
                ? `${rows.length}건 중 상위 ${ROW_LIMIT}건 표시 — 검색으로 좁혀주세요`
                : `총 ${rows.length}건 표시`}
            </span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">상품명</th>
                  <th className="py-2 pr-4">상품구분</th>
                  <th className="py-2 pr-4 text-right">원가</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.productName} className="border-b">
                    <td className="py-2 pr-4">{r.productName}</td>
                    <td className="py-2 pr-4">
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={r.categoryId ?? ''}
                        onChange={(e) =>
                          updateCategory(r.mappingId, r.productName, e.target.value || null)
                        }
                        disabled={!r.mappingId && r.categoryId === null}
                      >
                        <option value="">(미분류)</option>
                        {(mappings.data?.categories ?? []).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {r.catalogProductId ? (
                        <ProductCostEditor productId={r.catalogProductId} initialCost={r.cost} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
      {importOpen && (
        <MappingImportModal
          brandId={brandId}
          onClose={() => {
            setImportOpen(false)
            setOpen(false)
            mappings.mutate()
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}
