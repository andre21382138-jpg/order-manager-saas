'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProductCostEditor } from './product-cost-editor'
import { getCatalogProducts, type CatalogProductRow } from '@/lib/queries/products'

type SyncStatus = {
  latest: {
    id: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    started_at: string | null
    completed_at: string | null
    error_message: string | null
    result_summary: Record<string, unknown> | null
    created_at: string
  } | null
}

async function fetchSyncStatus(brandId: string, mall: string): Promise<SyncStatus> {
  const r = await fetch(`/api/brands/${brandId}/products-sync/status?mall=${encodeURIComponent(mall)}`)
  if (!r.ok) throw new Error('sync 상태 조회 실패')
  return r.json()
}

function fmtWon(n: number | null): string {
  if (n === null) return '-'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

function fmtKstTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 19).replace('T', ' ') + ' KST'
}

export function ProductInfoTab({
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
  const [running, setRunning] = useState(false)

  const status = useSWR(
    channel === 'cafe24' ? ['product-sync-status', brandId, mall] : null,
    () => fetchSyncStatus(brandId, mall),
    { refreshInterval: running ? 3000 : 0 }
  )

  const catalog = useSWR(
    channel === 'cafe24' ? ['catalog-products', brandId, mall] : null,
    () => getCatalogProducts(supabase, brandId, mall)
  )

  const latest = status.data?.latest ?? null
  useEffect(() => {
    if (!latest) return
    if (latest.status === 'pending' || latest.status === 'running') {
      setRunning(true)
    } else if (running && (latest.status === 'completed' || latest.status === 'failed')) {
      setRunning(false)
      catalog.mutate()
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.status])

  async function triggerSync() {
    const res = await fetch(`/api/brands/${brandId}/products-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mall }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? 'sync 요청 실패')
      return
    }
    setRunning(true)
    status.mutate()
  }

  if (channel !== 'cafe24') {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          🛠 <b>지원 예정</b> — 스마트스토어 상품 sync는 준비 중입니다.
          현재는 카페24 스토어에서만 상품 정보를 관리할 수 있습니다.
        </CardContent>
      </Card>
    )
  }

  const rows = catalog.data ?? []
  const inProgress = running || latest?.status === 'pending' || latest?.status === 'running'

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">상품 정보 ({rows.length}개)</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {latest && (
              <span>
                최근 sync: {fmtKstTime(latest.completed_at ?? latest.started_at ?? latest.created_at)} ·{' '}
                <span className={latest.status === 'failed' ? 'text-red-700' : ''}>
                  {latest.status}
                </span>
              </span>
            )}
            <Button size="sm" onClick={triggerSync} disabled={inProgress}>
              {inProgress ? '🔄 sync 중...' : '🔄 상품 sync'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {latest?.status === 'failed' && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            직전 sync 실패: {latest.error_message}
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-muted-foreground">
                <th className="whitespace-nowrap py-2 pr-4">상품코드</th>
                <th className="whitespace-nowrap py-2 pr-4">상품명</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">판매가</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right">원가</th>
              </tr>
            </thead>
            <tbody>
              {catalog.isLoading && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    불러오는 중...
                  </td>
                </tr>
              )}
              {!catalog.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    상품이 없습니다. 상품 sync를 실행해 카페24로부터 최신 목록을 받아오세요.
                  </td>
                </tr>
              )}
              {rows.map((r: CatalogProductRow) => (
                <tr key={r.productNo} className="border-b">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{r.productNo}</td>
                  <td className="py-2 pr-4">{r.productName}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.price)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">
                    <ProductCostEditor productId={r.catalogProductId} initialCost={r.cost} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
