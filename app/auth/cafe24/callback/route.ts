import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdapter } from '@/lib/adapters/_registry'
import { verifyOAuthState, CAFE24_OAUTH_COOKIE } from '@/lib/oauth-cookie'

function redirectWithError(origin: string, brandId: string | null, message: string) {
  const target = brandId
    ? `${origin}/brands/${brandId}/settings/connections?error=${encodeURIComponent(message)}`
    : `${origin}/brands?error=${encodeURIComponent(message)}`
  const res = NextResponse.redirect(target, { status: 303 })
  res.cookies.set({
    name: CAFE24_OAUTH_COOKIE,
    value: '',
    path: '/auth/cafe24',
    maxAge: 0,
  })
  return res
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // 사용자가 카페24 동의 화면에서 거부
  if (error) {
    return redirectWithError(origin, null, `카페24 연결 취소: ${error}`)
  }
  if (!code || !state) {
    return redirectWithError(origin, null, 'OAuth code/state 누락')
  }

  // 쿠키 복원
  const cookieStore = await cookies()
  const stateCookie = cookieStore.get(CAFE24_OAUTH_COOKIE)?.value
  if (!stateCookie) {
    return redirectWithError(origin, null, 'OAuth state 쿠키가 없거나 만료되었습니다')
  }

  let stateData: Awaited<ReturnType<typeof verifyOAuthState>>
  try {
    stateData = await verifyOAuthState(stateCookie)
  } catch {
    return redirectWithError(origin, null, 'OAuth state 검증 실패')
  }

  // CSRF 검증
  if (state !== stateData.nonce) {
    return redirectWithError(origin, stateData.brandId, 'CSRF nonce 불일치')
  }

  // 본인 owner brand 검증
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirectWithError(origin, null, '로그인이 필요합니다')
  }
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', stateData.brandId)
    .single()
  if (!brand) {
    return redirectWithError(origin, null, '브랜드를 찾을 수 없거나 권한이 없습니다')
  }

  const adapter = getAdapter('cafe24')
  if (!adapter?.handleCallback) {
    return redirectWithError(origin, stateData.brandId, '카페24 어댑터 로드 실패')
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/cafe24/callback`

  // token 교환
  let payload
  try {
    payload = await adapter.handleCallback({
      code,
      mallId: stateData.mallId,
      appId: stateData.appId,
      appSecret: stateData.appSecret,
      redirectUri,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token 교환 실패'
    return redirectWithError(origin, stateData.brandId, msg)
  }

  // validate
  const v = await adapter.validate(payload)
  if (!v.ok) {
    return redirectWithError(origin, stateData.brandId, v.error)
  }

  // Vault + brand_credentials INSERT (admin 클라이언트로)
  const admin = createAdminClient()

  // vault schema는 PostgREST에 expose 안 되므로 public wrapper 호출
  const { data: secretId, error: vaultErr } = await admin
    .rpc('create_vault_secret', {
      secret: JSON.stringify(payload),
      name: `cafe24:${stateData.brandId}:${stateData.mallId}`,
      description: `${brand.name} / ${stateData.mallId}`,
    })
  if (vaultErr || !secretId) {
    return redirectWithError(
      origin,
      stateData.brandId,
      `Vault 저장 실패: ${vaultErr?.message ?? 'unknown'}`
    )
  }

  const { error: insertErr } = await admin
    .from('brand_credentials')
    .insert({
      brand_id: stateData.brandId,
      channel: 'cafe24',
      channel_account: stateData.mallId,
      secret_id: secretId,
      status: 'active',
      metadata: {
        scope: 'mall.read_order,mall.write_order,mall.read_analytics,mall.read_product,mall.read_category',
        expires_at: payload.expiresAt,
      },
    })

  if (insertErr) {
    // UNIQUE 위반 등
    const msg = insertErr.code === '23505'
      ? `이 mall(${stateData.mallId})은 이미 등록되어 있습니다`
      : `자격증명 저장 실패: ${insertErr.message}`
    return redirectWithError(origin, stateData.brandId, msg)
  }

  // 성공 → 쿠키 삭제 + connections 페이지로
  const res = NextResponse.redirect(
    `${origin}/brands/${stateData.brandId}/settings/connections?connected=${encodeURIComponent(`cafe24:${stateData.mallId}`)}`,
    { status: 303 }
  )
  res.cookies.set({
    name: CAFE24_OAUTH_COOKIE,
    value: '',
    path: '/auth/cafe24',
    maxAge: 0,
  })
  return res
}
