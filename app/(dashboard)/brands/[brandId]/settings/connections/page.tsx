import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Credential = {
  id: string
  channel: string
  channel_account: string
  status: string
  last_synced_at: string | null
}

function ChannelCard({
  title,
  channelKey,
  brandId,
  credentials,
  available,
}: {
  title: string
  channelKey: string
  brandId: string
  credentials: Credential[]
  available: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          {!available && (
            <span className="text-xs font-normal text-muted-foreground">준비 중</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 계정이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {credentials.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{c.status === 'active' ? '✅' : '⚠️'}</span>
                  <span className="font-medium">{c.channel_account}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.last_synced_at
                      ? `🔄 ${new Date(c.last_synced_at).toLocaleString('ko-KR')}`
                      : '🔄 -'}
                  </span>
                </div>
                <form action={`/api/credentials/${c.id}/delete`} method="post">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                  >
                    ✕
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {available ? (
          <Link
            href={`/brands/${brandId}/settings/connections/${channelKey}/new`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
          >
            + {title} 계정 추가
          </Link>
        ) : (
          <Button variant="outline" size="sm" className="w-full" disabled>
            + {title} 계정 추가
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { brandId } = await params
  const sp = await searchParams
  const supabase = await createServerClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, color')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  const { data: creds } = await supabase
    .from('brand_credentials')
    .select('id, channel, channel_account, status, last_synced_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })

  const credsByChannel: Record<string, Credential[]> = {}
  for (const c of creds ?? []) {
    if (!credsByChannel[c.channel]) credsByChannel[c.channel] = []
    credsByChannel[c.channel].push(c as Credential)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{brand.name} — 매체 연동</h1>

      {sp.connected && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-3 text-sm text-emerald-800">
            ✅ {sp.connected} 연결되었습니다.
          </CardContent>
        </Card>
      )}
      {sp.error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-3 text-sm text-red-800">
            ⚠️ {decodeURIComponent(sp.error)}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChannelCard
          title="카페24"
          channelKey="cafe24"
          brandId={brand.id}
          credentials={credsByChannel['cafe24'] ?? []}
          available
        />
        <ChannelCard
          title="스마트스토어"
          channelKey="smartstore"
          brandId={brand.id}
          credentials={credsByChannel['smartstore'] ?? []}
          available={false}
        />
        <ChannelCard
          title="네이버광고"
          channelKey="naver_ad"
          brandId={brand.id}
          credentials={credsByChannel['naver_ad'] ?? []}
          available={false}
        />
      </div>
    </div>
  )
}
