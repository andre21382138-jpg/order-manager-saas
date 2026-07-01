'use client'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  getMallList,
  getMallProducts,
  getCampaignMappings,
} from '@/lib/queries/products'

type Props = {
  brandId: string
  unit: { id: string; name: string }
  onClose: () => void
}

function extractWords(name: string): string[] {
  // 캠페인명에서 2글자 이상 단어 추출 (공백/기호 기준)
  return name
    .split(/[\s_\-\/\(\)\[\]\{\}\.,+&#@!?:;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
}

function matchesAnyWord(productName: string, words: string[]): boolean {
  if (words.length === 0) return true
  const lower = productName.toLowerCase()
  return words.some((w) => lower.includes(w.toLowerCase()))
}

export function ProductMappingModal({ brandId, unit, onClose }: Props) {
  const supabase = createBrowserClient()
  const [mall, setMall] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [autoFilter, setAutoFilter] = useState(true)
  const [saving, setSaving] = useState(false)

  const words = useMemo(() => extractWords(unit.name), [unit.name])

  const malls = useSWR(['mall-list', brandId], () => getMallList(supabase, brandId))

  useEffect(() => {
    if (!mall && malls.data && malls.data.length > 0) {
      setMall(malls.data[0])
    }
  }, [malls.data, mall])

  const products = useSWR(
    mall ? ['mall-products', brandId, mall] : null,
    () => getMallProducts(supabase, brandId, mall)
  )

  const existing = useSWR(['mappings', unit.id], () =>
    getCampaignMappings(supabase, unit.id)
  )

  // mall 바뀔 때 기존 매핑을 selected로 로드
  useEffect(() => {
    if (!mall || !existing.data) return
    const names = existing.data
      .filter((m) => m.mallType === mall)
      .map((m) => m.productName)
    setSelected(new Set(names))
  }, [mall, existing.data])

  const filtered = useMemo(() => {
    const list = products.data ?? []
    const q = query.trim().toLowerCase()
    return list.filter((p) => {
      if (q !== '' && !p.productName.toLowerCase().includes(q)) return false
      if (autoFilter && !matchesAnyWord(p.productName, words)) return false
      return true
    })
  }, [products.data, query, autoFilter, words])

  function toggle(name: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })
  }

  async function save() {
    if (!mall) return
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${unit.id}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mall_type: mall,
          product_names: Array.from(selected),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? '저장 실패')
        return
      }
      await existing.mutate()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="!max-w-[min(95vw,720px)] w-full">
        <DialogHeader>
          <DialogTitle>{unit.name} — 상품 매칭</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted-foreground">쇼핑몰</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={mall}
              onChange={(e) => setMall(e.target.value)}
            >
              <option value="">선택</option>
              {(malls.data ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="search"
              placeholder="상품 검색"
              className="rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={autoFilter}
                onChange={(e) => setAutoFilter(e.target.checked)}
              />
              캠페인명 단어 자동 필터
            </label>
          </div>

          {autoFilter && words.length > 0 && (
            <div className="text-xs text-muted-foreground">
              필터 단어: {words.join(', ')}
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            {!mall && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                쇼핑몰을 선택하세요
              </div>
            )}
            {mall && products.isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">로딩 중...</div>
            )}
            {mall && !products.isLoading && filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                조건에 맞는 상품이 없습니다
              </div>
            )}
            {mall && !products.isLoading && filtered.length > 0 && (
              <ul className="divide-y">
                {filtered.map((p) => (
                  <li key={p.productName} className="flex items-center gap-2 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(p.productName)}
                      onChange={() => toggle(p.productName)}
                      id={`mp-${p.productName}`}
                    />
                    <label htmlFor={`mp-${p.productName}`} className="flex-1 cursor-pointer">
                      {p.productName}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              선택 {selected.size}개
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                취소
              </Button>
              <Button onClick={save} disabled={saving || !mall}>
                {saving ? '저장 중...' : '매칭'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
