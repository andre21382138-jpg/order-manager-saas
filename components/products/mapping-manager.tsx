'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MappingImportModal } from './mapping-import-modal'
import { getUnmappedProducts, type UnmappedProductRow } from '@/lib/queries/products'

async function fetchMappingCount(brandId: string): Promise<number> {
  const r = await fetch(`/api/brands/${brandId}/category-mappings`)
  if (!r.ok) throw new Error('매핑 조회 실패')
  const j = await r.json()
  return (j.mappings ?? []).length
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
  const supabase = createBrowserClient()

  const mappingCount = useSWR(['mapping-count', brandId], () => fetchMappingCount(brandId))
  const unmapped = useSWR(
    open ? ['unmapped', brandId, mall] : null,
    () => getUnmappedProducts(supabase, brandId, mall)
  )

  const total = mappingCount.data ?? 0
  const unmappedCount = unmapped.data?.length ?? 0

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
            💡 아래는 카페24 상품마스터에는 있지만 매핑 파일에 상품구분이 지정되지 않은 상품입니다.
            Excel 파일에 이 상품코드와 상품구분을 추가한 뒤 재 import 하면 됩니다.
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 pr-4">상품코드</th>
                  <th className="whitespace-nowrap py-2 pr-4">상품명</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">판매가</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">최근30일 판매수량</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">최근30일 매출</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.data && unmapped.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      ✅ 모든 카페24 상품이 매핑되어 있습니다.
                    </td>
                  </tr>
                )}
                {(unmapped.data ?? []).map((r) => (
                  <tr key={r.productNo} className="border-b">
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{r.productNo}</td>
                    <td className="py-2 pr-4">{r.productName}</td>
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
            mappingCount.mutate()
            unmapped.mutate()
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}
