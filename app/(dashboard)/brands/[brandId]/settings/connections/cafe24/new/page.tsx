import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function NewCafe24CredentialPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { brandId } = await params
  const sp = await searchParams
  const supabase = await createServerClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/cafe24/callback`

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{brand.name} — 카페24 계정 추가</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 space-y-2">
            <p className="font-medium">사전 준비: 카페24 개발자 콘솔에서 앱 등록</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <a
                  href="https://developers.cafe24.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  카페24 개발자 센터
                </a>
                에 로그인 → 본인 mall로 앱 등록
              </li>
              <li>
                Redirect URI 등록 (둘 다 등록 권장):
                <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                  <li>{redirectUri}</li>
                  <li>http://localhost:3030/auth/cafe24/callback</li>
                </ul>
              </li>
              <li>
                Scope 설정:{' '}
                <span className="font-mono text-xs">
                  mall.read_order, mall.write_order, mall.read_analytics, mall.read_product,
                  mall.read_category
                </span>
              </li>
              <li>앱 등록 후 발급되는 Client ID / Client Secret을 아래 입력</li>
            </ol>
          </div>

          {sp.error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              ⚠️ {decodeURIComponent(sp.error)}
            </div>
          )}

          <form action="/api/oauth/cafe24/start" method="POST" className="space-y-4">
            <input type="hidden" name="brand_id" value={brand.id} />

            <div className="space-y-2">
              <Label htmlFor="mall_id">Mall ID</Label>
              <Input
                id="mall_id"
                name="mall_id"
                required
                placeholder="예: paleo"
                pattern="[a-zA-Z0-9_-]+"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                카페24 mall의 서브도메인 (예: paleo.cafe24.com → paleo)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app_id">Client ID (App ID)</Label>
              <Input id="app_id" name="app_id" required autoComplete="off" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="app_secret">Client Secret (App Secret)</Label>
              <Input
                id="app_secret"
                name="app_secret"
                type="password"
                required
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                입력값은 안전하게 암호화되어 저장됩니다 (Supabase Vault).
              </p>
            </div>

            <Button type="submit" className="w-full">OAuth 시작</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
