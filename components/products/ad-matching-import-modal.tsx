'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ImportResult = {
  ok: true
  upserted: number
  skipped: number
  errors: Array<{ row: number; message: string }>
  errorsMore: number
  conflicts: Array<{ adGroupName: string; count: number }>
  elapsedMs: number
}

export function AdMatchingImportModal({
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
      const res = await fetch(`/api/brands/${brandId}/ad-group-mappings/import`, {
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
          <DialogTitle>Excel Import — 광고그룹 상품구분 매칭</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            ℹ️ <b>병합 저장</b>: 기존 매핑은 유지되고, Excel 내용만 upsert 됩니다.
            필수 컬럼: <code>광고그룹</code>, <code>상품구분</code>.
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
              <div>· 매핑 upsert: {result.upserted}건</div>
              {result.skipped > 0 && (
                <div className="text-amber-700">· 값 누락 스킵: {result.skipped}건</div>
              )}
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-700">
                    ⚠️ 매칭 실패 {result.errors.length + result.errorsMore}건
                  </summary>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {result.errors.map((e, i) => (
                      <li key={i}>row {e.row}: {e.message}</li>
                    ))}
                    {result.errorsMore > 0 && (
                      <li>… 외 {result.errorsMore}건</li>
                    )}
                  </ul>
                </details>
              )}
              {result.conflicts.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-amber-700">
                    ⚠️ 동명이 광고그룹 {result.conflicts.length}건 (첫 번째로 매핑됨)
                  </summary>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {result.conflicts.map((c, i) => (
                      <li key={i}>{c.adGroupName} ({c.count}개)</li>
                    ))}
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
