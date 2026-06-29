import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getAdapter } from '@/lib/adapters/_registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const CHANNEL_TITLES: Record<string, string> = {
  smartstore: '스마트스토어',
  naver_ad: '네이버광고',
}

const CHANNEL_GUIDES: Record<string, { lines: string[]; link?: { href: string; label: string } }> = {
  smartstore: {
    lines: [
      'naver commerce 개발자센터(commerce.naver.com)에 로그인 → 앱 등록',
      '발급된 Client ID와 Client Secret을 아래 입력',
      'SaaS는 client_credentials grant로 매번 토큰을 새로 발급하므로 IP 등록 불필요',
    ],
    link: { href: 'https://apicenter.commerce.naver.com/', label: 'naver commerce 개발자센터' },
  },
  naver_ad: {
    lines: [
      '네이버광고(searchad.naver.com) 로그인 → 도구 → API 관리',
      'Customer ID, Access License, Secret Key 발급',
      '서명 방식 인증이라 IP 등록 불필요',
    ],
    link: { href: 'https://searchad.naver.com/customers/api', label: '네이버광고 API 관리' },
  },
}

export default async function NewApiKeyCredentialPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string; channel: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { brandId, channel } = await params
  const sp = await searchParams

  const adapter = getAdapter(channel)
  if (!adapter || adapter.authType !== 'api_key' || !adapter.credentialFields) {
    notFound()
  }

  const supabase = await createServerClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  const title = CHANNEL_TITLES[channel] ?? channel
  const guide = CHANNEL_GUIDES[channel]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {brand.name} — {title} 계정 추가
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {guide && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 space-y-2">
              <p className="font-medium">사전 준비</p>
              <ol className="list-decimal space-y-1 pl-5">
                {guide.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
              {guide.link && (
                <p>
                  <a
                    href={guide.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {guide.link.label} 바로가기
                  </a>
                </p>
              )}
            </div>
          )}

          {sp.error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              ⚠️ {decodeURIComponent(sp.error)}
            </div>
          )}

          <form
            action={`/api/credentials/${channel}/register`}
            method="POST"
            className="space-y-4"
          >
            <input type="hidden" name="brand_id" value={brand.id} />

            {adapter.credentialFields!.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  name={field.key}
                  type={field.secret ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  required
                  autoComplete="off"
                />
                {field.hint && (
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                )}
              </div>
            ))}

            <Button type="submit" className="w-full">
              검증 후 등록
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
