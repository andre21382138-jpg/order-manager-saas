'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="gap-1.5"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} />
      새로고침
    </Button>
  )
}
