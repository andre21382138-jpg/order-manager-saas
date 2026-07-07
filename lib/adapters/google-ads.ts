import 'server-only'
import type {
  ChannelAdapter,
  CredentialPayload,
  ValidateResult,
  SyncContext,
} from './_types'

function normalizeId(v: string): string {
  return String(v ?? '').replace(/[^0-9]/g, '')
}

function buildPayload(formValues: Record<string, string>): CredentialPayload {
  return {
    customerId: normalizeId(formValues.customerId),
    loginCustomerId: normalizeId(formValues.loginCustomerId),
    developerToken: formValues.developerToken,
    clientId: formValues.clientId,
    clientSecret: formValues.clientSecret,
    refreshToken: formValues.refreshToken,
  }
}

async function validate(creds: CredentialPayload): Promise<ValidateResult> {
  const clientId = String(creds.clientId ?? '')
  const clientSecret = String(creds.clientSecret ?? '')
  const refreshToken = String(creds.refreshToken ?? '')
  const developerToken = String(creds.developerToken ?? '')
  const customerId = String(creds.customerId ?? '')
  const loginCustomerId = String(creds.loginCustomerId ?? '')
  if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId || !loginCustomerId) {
    return { ok: false, error: '모든 필드가 필요합니다' }
  }

  // 1) OAuth token exchange
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  let tokenRes: Response
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error'
    return { ok: false, error: `OAuth 호출 실패: ${msg}` }
  }
  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => '')
    return { ok: false, error: `Refresh Token 검증 실패 (${tokenRes.status}): ${txt.slice(0, 200)}` }
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  if (!tokenJson.access_token) {
    return { ok: false, error: 'access_token 발급 실패' }
  }

  // 2) Google Ads API로 간단한 customer 조회 (검증)
  const url = `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:search`
  let adsRes: Response
  try {
    adsRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'developer-token': developerToken,
        'login-customer-id': loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT customer.id FROM customer' }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error'
    return { ok: false, error: `Google Ads API 호출 실패: ${msg}` }
  }

  if (adsRes.status === 401) {
    return { ok: false, error: '액세스 토큰이 유효하지 않습니다' }
  }
  if (adsRes.status === 403) {
    // 403 PERMISSION_DENIED — Test Access이거나 Basic Access 미승인 상태.
    // OAuth 자체는 통과했으므로 등록 허용 (승인 후 sync가 자동으로 성공)
    return { ok: true }
  }
  if (!adsRes.ok) {
    const txt = await adsRes.text().catch(() => '')
    return { ok: false, error: `Google Ads API 오류 (${adsRes.status}): ${txt.slice(0, 800)}` }
  }

  return { ok: true }
}

async function syncAdStats(
  _creds: CredentialPayload,
  _ctx: SyncContext
): Promise<{ ok: false; error: string; retryable: boolean }> {
  throw new Error('syncAdStats must run on virtual server sync-worker (not Vercel)')
}

async function syncAdUnits(
  _creds: CredentialPayload,
  _ctx: SyncContext
): Promise<{ ok: false; error: string; retryable: boolean }> {
  throw new Error('syncAdUnits must run on virtual server sync-worker (not Vercel)')
}

export const googleAdsAdapter: ChannelAdapter = {
  channel: 'google_ads',
  category: 'ad',
  authType: 'api_key',
  credentialFields: [
    {
      key: 'accountLabel',
      label: '계정 이름 (별칭)',
      placeholder: '예: 아프리모_구글',
    },
    {
      key: 'customerId',
      label: 'Customer ID',
      placeholder: '316-962-9282 (또는 3169629282)',
      hint: '아프리모 구글 광고 계정 ID (하이픈 자동 제거)',
    },
    {
      key: 'loginCustomerId',
      label: 'MCC ID (관리자 계정)',
      placeholder: 'XXX-XXX-XXXX',
      hint: 'Developer Token이 발급된 상위 MCC 계정 ID',
    },
    {
      key: 'developerToken',
      label: 'Developer Token',
      secret: true,
    },
    {
      key: 'clientId',
      label: 'OAuth Client ID',
      placeholder: 'xxx.apps.googleusercontent.com',
    },
    {
      key: 'clientSecret',
      label: 'OAuth Client Secret',
      secret: true,
    },
    {
      key: 'refreshToken',
      label: 'Refresh Token',
      secret: true,
      hint: 'OAuth Playground로 발급받은 1// 로 시작하는 값',
    },
  ],
  buildPayload,
  validate,
  syncAdStats,
  syncAdUnits,
}
