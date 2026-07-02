'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ImportResult = {
  ok: true
  categoriesCount: number
  mappingsCount: number
  conflicts: Array<{ productNo: string; chosenCategory: string; otherCategories: string[] }>
  skippedNoCode: number
  elapsedMs: number
}

export function MappingImportModal({
  brandId,
  onClose,
}: {
  brandId: string
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload() {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/brands/${brandId}/category-mappings/import`, {
        method: 'POST',
        body: form,
      })
      const text = await res.text()
      let j: { ok?: boolean; error?: string } & Record<string, unknown> = {}
      try {
        j = JSON.parse(text)
      } catch {
        setError(`서버 응답이 JSON이 아닙니다 (status ${res.status}): ${text.slice(0, 300)}`)
        return
      }
      if (!res.ok || !j.ok) {
        setError(j.error ?? `업로드 실패 (status ${res.status})`)
      } else {
        setResult(j as unknown as ImportResult)
      }
    } catch (e) {
      setError(`네트워크 오류: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="!max-w-[min(95vw,640px)] w-full">
        <DialogHeader>
          <DialogTitle>Excel Import — 상품구분 매핑</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ⚠️ 업로드하면 이 브랜드의 기존 카테고리와 매핑이 <b>전체 삭제 후 재구축</b>됩니다.
            연결된 광고 매칭(campaign_product_mappings)도 삭제됩니다.
          </div>

          <div className="text-sm">
            필수 컬럼: <code>상품구분</code>, <code>상품코드</code>. 선택 컬럼: <code>상품명</code> (참조용).
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
              📎 파일 선택
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            <span className="text-sm text-muted-foreground truncate">
              {file ? file.name : '선택된 파일 없음'}
            </span>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div>✅ 완료 ({result.elapsedMs}ms)</div>
              <div>· 카테고리: {result.categoriesCount}개</div>
              <div>· 매핑: {result.mappingsCount}건</div>
              {result.skippedNoCode > 0 && (
                <div className="text-amber-700">· 상품코드 누락 스킵: {result.skippedNoCode}건</div>
              )}
              {result.conflicts.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-amber-700">
                    ⚠️ 충돌 {result.conflicts.length}건 (last-write-wins 적용)
                  </summary>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {result.conflicts.slice(0, 100).map((c) => (
                      <li key={c.productNo}>
                        상품코드 <b>{c.productNo}</b> → <b>{c.chosenCategory}</b> (다른 후보: {c.otherCategories.join(', ')})
                      </li>
                    ))}
                    {result.conflicts.length > 100 && (
                      <li>… 외 {result.conflicts.length - 100}건</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              닫기
            </Button>
            <Button onClick={upload} disabled={!file || uploading}>
              {uploading ? '업로드 중...' : '업로드'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
