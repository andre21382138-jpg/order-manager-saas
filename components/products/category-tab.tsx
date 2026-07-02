'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MappingImportModal } from './mapping-import-modal'
import {
  getMappedProducts,
  getUnmappedProducts,
  type UnmappedProductRow,
} from '@/lib/queries/products'

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

function fmtWon(n: number | null): string {
  if (n === null) return '-'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function CategoryTab({
  brandId,
  mall,
  channel,
}: {
  brandId: string
  mall: string
  channel: 'cafe24' | 'smartstore' | null
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [importOpen, setImportOpen] = useState(false)
  const [savingNo, setSavingNo] = useState<string | null>(null)

  const summary = useSWR(
    channel === 'cafe24' ? ['mappings-summary', brandId] : null,
    () => fetchMappingsSummary(brandId)
  )
  const mapped = useSWR(
    channel === 'cafe24' ? ['mapped', brandId, mall] : null,
    () => getMappedProducts(supabase, brandId, mall)
  )
  const unmapped = useSWR(
    channel === 'cafe24' ? ['unmapped', brandId, mall] : null,
    () => getUnmappedProducts(supabase, brandId, mall)
  )

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
      await Promise.all([summary.mutate(), mapped.mutate(), unmapped.mutate()])
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

  if (channel !== 'cafe24') {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          🛠 <b>지원 예정</b> — 스마트스토어 상품구분 매핑은 준비 중입니다.
          현재는 카페24 스토어에서만 상품구분을 지정할 수 있습니다.
        </CardContent>
      </Card>
    )
  }

  const categories = summary.data?.categories ?? []
  const mappedRows = mapped.data ?? []
  const unmappedRows = unmapped.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setImportOpen(true)}>Excel Import</Button>
        <Button
          size="sm"
          variant="outline"
          disabled={unmappedRows.length === 0}
          onClick={() => copyTsv(unmappedRows)}
        >
          📋 미매핑 TSV 복사
        </Button>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        💡 Excel Import는 <b>병합 저장</b>이므로 UI에서 지정한 매핑은 재 import 후에도 보존됩니다.
        상품 sync 후 catalog에 새로 들어온 상품이 미매핑에 자동 추가됩니다.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            매핑 완료 · {mappedRows.length}개 상품
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 pr-4">상품구분</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품코드</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품명</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">판매가</th>
                </tr>
              </thead>
              <tbody>
                {mapped.isLoading && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {!mapped.isLoading && mappedRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      아직 매핑된 상품이 없습니다.
                    </td>
                  </tr>
                )}
                {mappedRows.map((r) => (
                  <tr key={r.productNo} className="border-b">
                    <td className="py-2 pr-4">{r.categoryName}</td>
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{r.productNo}</td>
                    <td className="py-2 pr-4">{r.productName}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            미매핑 · {unmappedRows.length}개 상품
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 pr-4">상품코드</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품명</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">판매가</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품구분 지정</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.isLoading && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {!unmapped.isLoading && unmappedRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      ✅ 모든 카페24 상품이 매핑되어 있습니다.
                    </td>
                  </tr>
                )}
                {unmappedRows.map((r) => (
                  <tr key={r.productNo} className="border-b">
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{r.productNo}</td>
                    <td className="py-2 pr-4">{r.productName}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.price)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {importOpen && (
        <MappingImportModal
          brandId={brandId}
          onClose={() => {
            setImportOpen(false)
            summary.mutate()
            mapped.mutate()
            unmapped.mutate()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
