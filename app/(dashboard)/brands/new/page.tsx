'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewBrandPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const r = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await r.json()
    setLoading(false)

    if (!r.ok) {
      setError(data.error ?? '브랜드 생성 실패')
      return
    }
    router.push(`/brands/${data.id}/settings/connections`)
    router.refresh()
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>새 브랜드 추가</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">브랜드 이름</Label>
            <Input
              id="brand-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              placeholder="예: 팔레오"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              색상은 자동으로 부여됩니다. 나중에 운영자에게 변경 요청 가능.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !name.trim()} className="w-full">
              {loading ? '추가 중...' : '추가'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
