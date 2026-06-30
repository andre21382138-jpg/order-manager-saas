'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  id: string
  channelAccount: string
  status: string
  lastSyncedAt: string | null
}

export function CredentialRow({ id, channelAccount, status, lastSyncedAt }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(channelAccount)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function save() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('별칭이 비어있습니다')
      return
    }
    if (trimmed === channelAccount) {
      setEditing(false)
      return
    }
    setError(null)
    const res = await fetch(`/api/credentials/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_account: trimmed }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: '실패' }))
      setError(j.error ?? '실패')
      return
    }
    setEditing(false)
    startTransition(() => router.refresh())
  }

  return (
    <li className="rounded border p-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          <span>{status === 'active' ? '✅' : '⚠️'}</span>
          {editing ? (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') {
                  setValue(channelAccount)
                  setError(null)
                  setEditing(false)
                }
              }}
              className="flex-1 rounded-md border border-input bg-background px-2 py-0.5 text-sm"
            />
          ) : (
            <span className="font-medium">{channelAccount}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {lastSyncedAt ? `🔄 ${new Date(lastSyncedAt).toLocaleString('ko-KR')}` : '🔄 -'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={save} disabled={isPending}>
                저장
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValue(channelAccount)
                  setError(null)
                  setEditing(false)
                }}
              >
                취소
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                aria-label="이름 변경"
                title="이름 변경"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <form action={`/api/credentials/${id}/delete`} method="post">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  aria-label="삭제"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}
