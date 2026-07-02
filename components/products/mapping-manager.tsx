'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MappingImportModal } from './mapping-import-modal'
import { getUnmappedProducts, type UnmappedProductRow } from '@/lib/queries/products'

type MappingsSummary = {
  count: number
  categories: { id: string; name: string }[]
}

async function fetchMappingsSummary(brandId: string): Promise<MappingsSummary> {
  const r = await fetch(`/api/brands/${brandId}/category-mappings`)
  if (!r.ok) throw new Error('매핑 조회 실패')
  const j = await r.json()
  return {
    count: (j.mappings ?? []).length,
    categories: j.categories ?? [],
  }
}

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
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
  const [savingNo, setSavingNo] = useState<string | null>(null)
  const supabase = createBrowserClient()

  const summary = useSWR(['mappings-summary', brandId], () => fetchMappingsSummary(brandId))
  const unmapped = useSWR(
    open ? ['unmapped', brandId, mall] : null,
    () => getUnmappedProducts(supabase, brandId, mall)
  )

  const total = summary.data?.count ?? 0
  const categories = summary.data?.categories ?? []
  const unmappedCount = unmapped.data?.length ?? 0

  async function assignCategory(row: UnmappedProductRow, categoryId: string) {
    if (!categoryId) return
    setSavingNo(row.productNo)
    try {
      const res = await fetch(`/api/brands/${brandId}/category-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_no: row.productNo,
          product_name: row.productName,
          category_id: categoryId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? '저장 실패')
        return
      }
      await Promise.all([summary.mutate(), unmapped.mutate()])
      router.refresh()
    } finally {
      setSavingNo(null)
    }
  }

  async function copyTsv(rows: UnmappedProductRow[]) {
    const header = ['상품코드', '상품명', '판매가', '최근30일_판매수량', '최근30일_매출'].join('\t')
    const body = rows
      .map((r) => [r.productNo, r.productName, r.price ?? '', r.recentQty, r.recentAmount].join('\t'))
      .join('\n')
    await navigator.clipboard.writeText(`${header}\n${body}`)
    alert(`미매핑 ${rows.length}개 TSV로 복사됨. Excel에 붙여넣기 가능.`)
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="text-base">
          📌 매핑 관리 · 총 매핑 {total}건
          {open && unmapped.data ? ` · 카페24 미매핑 상품 ${unmappedCount}개` : ''}
          {' '}{open ? '▼' : '▶'}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setImportOpen(true)}>Excel Import</Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!unmapped.data || unmapped.data.length === 0}
              onClick={() => unmapped.data && copyTsv(unmapped.data)}
            >
              📋 미매핑 TSV 복사
            </Button>
            {unmapped.isLoading && (
              <span className="text-xs text-muted-foreground">불러오는 중...</span>
            )}
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            💡 표에서 dropdown으로 바로 상품구분을 지정하거나, TSV 복사 후 Excel로 일괄 편집 후 재 import 하세요.
            Excel Import는 <b>병합 저장</b>이므로 여기서 지정한 매핑은 재 import 후에도 보존됩니다.
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 pr-4">상품코드</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품명</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품구분 지정</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">판매가</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">최근30일 판매수량</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">최근30일 매출</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.data && unmapped.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground">
                      ✅ 모든 카페24 상품이 매핑되어 있습니다.
                    </td>
                  </tr>
                )}
                {(unmapped.data ?? []).map((r) => (
                  <tr key={r.productNo} className="border-b">
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{r.productNo}</td>
                    <td className="py-2 pr-4">{r.productName}</td>
                    <td className="py-2 pr-4">
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value=""
                        disabled={savingNo === r.productNo}
                        onChange={(e) => assignCategory(r, e.target.value)}
                      >
                        <option value="">
                          {savingNo === r.productNo ? '저장 중...' : '선택하세요'}
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">
                      {r.price === null ? '-' : fmtWon(r.price)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">
                      {r.recentQty > 0 ? `${r.recentQty.toLocaleString('ko-KR')}개` : '-'}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">
                      {r.recentAmount > 0 ? fmtWon(r.recentAmount) : '-'}
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
            summary.mutate()
            unmapped.mutate()
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}
