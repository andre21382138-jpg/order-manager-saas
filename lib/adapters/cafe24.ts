import 'server-only'
import type {
  ChannelAdapter,
  GetAuthUrlInput,
  HandleCallbackInput,
  CredentialPayload,
  ValidateResult,
  SyncContext,
} from './_types'

export const CAFE24_SCOPES = [
  'mall.read_order',
  'mall.write_order',
  'mall.read_analytics',
  'mall.read_product',
  'mall.read_category',
] as const

export const CAFE24_API_VERSION = '2025-12-01'

function basicAuth(appId: string, appSecret: string): string {
  return 'Basic ' + Buffer.from(`${appId}:${appSecret}`).toString('base64')
}

function getAuthUrl({ appId, mallId, state, redirectUri }: GetAuthUrlInput): string {
  const url = new URL(`https://${mallId}.cafe24api.com/api/v2/oauth/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', CAFE24_SCOPES.join(','))
  return url.toString()
}

async function handleCallback({
  code,
  mallId,
  appId,
  appSecret,
  redirectUri,
}: HandleCallbackInput): Promise<CredentialPayload> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  }).toString()

  const r = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(appId, appSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const text = await r.text()
  if (!r.ok) {
    throw new Error(`카페24 token 교환 실패 (${r.status}): ${text.slice(0, 300)}`)
  }

  let tok: { access_token?: string; refresh_token?: string; expires_at?: string }
  try {
    tok = JSON.parse(text)
  } catch {
    throw new Error(`카페24 응답 파싱 실패: ${text.slice(0, 200)}`)
  }

  if (!tok.access_token || !tok.refresh_token) {
    throw new Error('카페24 응답에 access_token/refresh_token 없음')
  }

  return {
    appId,
    appSecret,
    mallId,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: tok.expires_at ?? '',
  }
}

async function validate(creds: CredentialPayload): Promise<ValidateResult> {
  const mallId = String(creds.mallId ?? '')
  const accessToken = String(creds.accessToken ?? '')
  if (!mallId || !accessToken) {
    return { ok: false, error: 'mallId 또는 accessToken 누락' }
  }

  // 우리 scope에 포함된 권한으로 토큰 유효성 확인 (mall.read_category)
  const r = await fetch(`https://${mallId}.cafe24api.com/api/v2/admin/categories?limit=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Cafe24-Api-Version': CAFE24_API_VERSION,
    },
  })

  if (r.ok) return { ok: true }

  if (r.status === 401) {
    return { ok: false, error: '토큰이 유효하지 않습니다 (401). app_id/app_secret을 다시 확인해주세요' }
  }
  if (r.status === 403) {
    return { ok: false, error: 'scope 권한이 부족합니다. 카페24 앱 콘솔에서 scope를 확인해주세요' }
  }
  const text = await r.text().catch(() => '')
  return { ok: false, error: `카페24 API 에러 (${r.status}): ${text.slice(0, 200)}` }
}

async function refreshToken(
  _creds: CredentialPayload
): Promise<{ ok: false; error: string }> {
  throw new Error('refreshToken must run on virtual server sync-worker (not Vercel)')
}

async function syncOrders(
  _creds: CredentialPayload,
  _ctx: SyncContext
): Promise<{ ok: false; error: string; retryable: boolean }> {
  throw new Error('syncOrders must run on virtual server sync-worker (not Vercel)')
}

async function syncProducts(
  _creds: CredentialPayload,
  _ctx: SyncContext
): Promise<{ ok: false; error: string; retryable: boolean }> {
  throw new Error('syncProducts must run on virtual server sync-worker (not Vercel)')
}

async function syncAnalytics(
  _creds: CredentialPayload,
  _ctx: SyncContext
): Promise<{ ok: false; error: string; retryable: boolean }> {
  throw new Error('syncAnalytics must run on virtual server sync-worker (not Vercel)')
}

export const cafe24Adapter: ChannelAdapter = {
  channel: 'cafe24',
  category: 'shop',
  authType: 'oauth',
  getAuthUrl,
  handleCallback,
  validate,
  refreshToken,
  syncOrders,
  syncProducts,
  syncAnalytics,
}
