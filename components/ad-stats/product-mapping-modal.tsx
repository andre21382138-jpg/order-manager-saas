'use client'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@/lib/supabase/client'

type Category = { id: string; name: string }

async function fetchCategories(brandId: string): Promise<Category[]> {
  const r = await fetch(`/api/brands/${brandId}/category-mappings`)
  if (!r.ok) return []
  const j = await r.json()
  return j.categories ?? []
}

async function fetchExisting(unitId: string): Promise<string[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('campaign_product_mappings')
    .select('category_id')
    .eq('ad_unit_id', unitId)
  if (error) return []
  return (data ?? []).map((r: { category_id: string }) => r.category_id)
}

function extractWords(name: string): string[] {
  return name
    .split(/[\s_\-\/\(\)\[\]\{\}\.,+&#@!?:;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
}

function matchesAnyWord(categoryName: string, words: string[]): boolean {
  if (words.length === 0) return true
  const lower = categoryName.toLowerCase()
  return words.some((w) => lower.includes(w.toLowerCase()))
}

type Props = {
  brandId: string
  unit: { id: string; name: string }
  onClose: () => void
}

export function ProductMappingModal({ brandId, unit, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [autoFilter, setAutoFilter] = useState(true)
  const [saving, setSaving] = useState(false)

  const words = useMemo(() => extractWords(unit.name), [unit.name])

  const cats = useSWR(['ad-mapping-cats', brandId], () => fetchCategories(brandId))
  const existing = useSWR(['ad-mapping-existing', unit.id], () => fetchExisting(unit.id))

  useEffect(() => {
    if (existing.data) setSelected(new Set(existing.data))
  }, [existing.data])

  const filtered = useMemo(() => {
    const list = cats.data ?? []
    const q = query.trim().toLowerCase()
    return list.filter((c) => {
      if (q !== '' && !c.name.toLowerCase().includes(q)) return false
      if (autoFilter && !matchesAnyWord(c.name, words)) return false
      return true
    })
  }, [cats.data, query, autoFilter, words])

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${unit.id}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_ids: Array.from(selected) }),
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
      <DialogContent className="!max-w-[min(95vw,640px)] w-full">
        <DialogHeader>
          <DialogTitle>{unit.name} — 카테고리 매칭</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="카테고리 검색"
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
            {cats.isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">로딩 중...</div>
            )}
            {!cats.isLoading && filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                조건에 맞는 카테고리가 없습니다
              </div>
            )}
            {!cats.isLoading && filtered.length > 0 && (
              <ul className="divide-y">
                {filtered.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      id={`cat-${c.id}`}
                    />
                    <label htmlFor={`cat-${c.id}`} className="flex-1 cursor-pointer">
                      {c.name}
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
              <Button onClick={save} disabled={saving}>
                {saving ? '저장 중...' : '매칭'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
