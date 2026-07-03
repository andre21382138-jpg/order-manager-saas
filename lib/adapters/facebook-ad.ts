import 'server-only'
import type {
  ChannelAdapter,
  CredentialPayload,
  ValidateResult,
  SyncContext,
} from './_types'

const META_API_VERSION = 'v19.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`

function buildPayload(formValues: Record<string, string>): CredentialPayload {
  return {
    adAccountId: normalizeAdAccountId(formValues.adAccountId),
    accessToken: formValues.accessToken,
  }
}

// "act_" 접두어를 제거하지 않고 통일된 형태로 저장
function normalizeAdAccountId(v: string): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  return s.startsWith('act_') ? s : `act_${s}`
}

async function validate(creds: CredentialPayload): Promise<ValidateResult> {
  const adAccountId = String(creds.adAccountId ?? '')
  const accessToken = String(creds.accessToken ?? '')
  if (!adAccountId || !accessToken) {
    return { ok: false, error: 'adAccountId, accessToken 필수' }
  }

  const url = `${META_BASE}/${encodeURIComponent(adAccountId)}?fields=id,name,account_status`
  let r: Response
  try {
    r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error'
    return { ok: false, error: `Meta API 호출 실패: ${msg}` }
  }

  if (r.status === 401 || r.status === 403) {
    return { ok: false, error: '액세스 토큰이 유효하지 않거나 권한이 없습니다' }
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    return { ok: false, error: `Meta API 오류 (${r.status}): ${txt.slice(0, 300)}` }
  }

  try {
    const j = (await r.json()) as { id?: string; name?: string; account_status?: number }
    if (!j.id) return { ok: false, error: '광고 계정 정보를 확인하지 못했습니다' }
    // account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED 등
    if (j.account_status && j.account_status !== 1) {
      return { ok: false, error: `광고 계정 상태 이상 (status ${j.account_status})` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Meta API 응답 파싱 실패' }
  }
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

export const facebookAdAdapter: ChannelAdapter = {
  channel: 'facebook_ad',
  category: 'ad',
  authType: 'api_key',
  credentialFields: [
    {
      key: 'accountLabel',
      label: '계정 이름 (별칭)',
      placeholder: '예: 아프리모_페북',
    },
    {
      key: 'adAccountId',
      label: '광고 계정 ID',
      placeholder: 'act_1234567890 (또는 숫자만)',
      hint: 'Meta 광고 관리자 URL의 act_XXXXXXXXX 부분',
    },
    {
      key: 'accessToken',
      label: '액세스 토큰',
      secret: true,
      hint: 'Meta 비즈니스 관리자 → 시스템 사용자 → 장기 액세스 토큰',
    },
  ],
  buildPayload,
  validate,
  syncAdStats,
  syncAdUnits,
}
