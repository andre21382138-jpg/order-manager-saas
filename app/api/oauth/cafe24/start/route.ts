import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { getAdapter } from '@/lib/adapters/_registry'
import { signOAuthState, CAFE24_OAUTH_COOKIE } from '@/lib/oauth-cookie'

function errorRedirect(url: URL, brandId: string | null, message: string) {
  const target = brandId
    ? `/brands/${brandId}/settings/connections/cafe24/new?error=${encodeURIComponent(message)}`
    : `/brands?error=${encodeURIComponent(message)}`
  return NextResponse.redirect(new URL(target, url), { status: 303 })
}

export async function POST(request: Request) {
  const reqUrl = new URL(request.url)
  const form = await request.formData()
  const brandId = String(form.get('brand_id') ?? '').trim()
  const mallId = String(form.get('mall_id') ?? '').trim()
  const appId = String(form.get('app_id') ?? '').trim()
  const appSecret = String(form.get('app_secret') ?? '').trim()

  if (!brandId || !mallId || !appId || !appSecret) {
    return errorRedirect(reqUrl, brandId || null, '모든 필드를 입력해주세요')
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(mallId)) {
    return errorRedirect(reqUrl, brandId, 'mall_id 형식이 올바르지 않습니다')
  }

  // 인증 + 본인 owner brand 확인
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', reqUrl), { status: 303 })
  }
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .single()
  if (!brand) {
    return errorRedirect(reqUrl, null, '브랜드를 찾을 수 없습니다')
  }

  const adapter = getAdapter('cafe24')
  if (!adapter?.getAuthUrl) {
    return errorRedirect(reqUrl, brandId, '카페24 어댑터를 로드할 수 없습니다')
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/cafe24/callback`
  const nonce = randomBytes(16).toString('base64url')

  const cookieToken = await signOAuthState({
    brandId,
    mallId,
    appId,
    appSecret,
    nonce,
  })

  const authorizeUrl = adapter.getAuthUrl({
    appId,
    mallId,
    state: nonce,
    redirectUri,
  })

  const res = NextResponse.redirect(authorizeUrl, { status: 303 })
  res.cookies.set({
    name: CAFE24_OAUTH_COOKIE,
    value: cookieToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth/cafe24',
    maxAge: 300,
  })
  return res
}
