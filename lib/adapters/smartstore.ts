import 'server-only'
import bcrypt from 'bcryptjs'
import type {
  ChannelAdapter,
  CredentialPayload,
  ValidateResult,
} from './_types'

const NAVER_COMMERCE_BASE = 'https://api.commerce.naver.com'

function buildPayload(formValues: Record<string, string>): CredentialPayload {
  return {
    clientId: formValues.clientId,
    clientSecret: formValues.clientSecret,
  }
}

async function validate(creds: CredentialPayload): Promise<ValidateResult> {
  const clientId = String(creds.clientId ?? '')
  const clientSecret = String(creds.clientSecret ?? '')
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'clientId/clientSecret 누락' }
  }

  const timestamp = Date.now()
  const password = `${clientId}_${timestamp}`
  const hashed = bcrypt.hashSync(password, clientSecret)
  const sign = Buffer.from(hashed).toString('base64')

  const body = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: sign,
    grant_type: 'client_credentials',
    type: 'SELF',
  }).toString()

  let r: Response
  try {
    r = await fetch(`${NAVER_COMMERCE_BASE}/external/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error'
    return { ok: false, error: `스마트스토어 호출 실패: ${msg}` }
  }

  if (r.ok) {
    const data = (await r.json().catch(() => null)) as { access_token?: string } | null
    if (data?.access_token) return { ok: true }
    return { ok: false, error: '응답에 access_token 없음' }
  }
  if (r.status === 400 || r.status === 401) {
    return { ok: false, error: 'Client ID 또는 Secret이 올바르지 않습니다' }
  }
  const text = await r.text().catch(() => '')
  return { ok: false, error: `스마트스토어 API 에러 (${r.status}): ${text.slice(0, 200)}` }
}

export const smartstoreAdapter: ChannelAdapter = {
  channel: 'smartstore',
  category: 'shop',
  authType: 'api_key',
  credentialFields: [
    {
      key: 'accountLabel',
      label: '계정 이름 (별칭)',
      placeholder: '예: 메인스토어',
      hint: '이 SaaS에서 식별용. 실제 매체 ID 아님.',
    },
    {
      key: 'clientId',
      label: 'Client ID',
      placeholder: 'naver commerce 개발자센터에서 발급',
    },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      secret: true,
    },
  ],
  buildPayload,
  validate,
}
