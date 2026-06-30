import 'server-only'
import type {
  ChannelAdapter,
  CredentialPayload,
  ValidateResult,
  SyncContext,
} from './_types'

function buildPayload(formValues: Record<string, string>): CredentialPayload {
  return {
    clientId: formValues.clientId,
    clientSecret: formValues.clientSecret,
  }
}

async function validate(creds: CredentialPayload): Promise<ValidateResult> {
  const proxyUrl = process.env.VALIDATE_PROXY_URL
  const token = process.env.VALIDATE_PROXY_TOKEN
  if (!proxyUrl || !token) {
    return { ok: false, error: 'validate-proxy 설정 누락 (VALIDATE_PROXY_URL/TOKEN)' }
  }

  let r: Response
  try {
    r = await fetch(`${proxyUrl}/validate/smartstore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': token,
      },
      body: JSON.stringify({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error'
    return { ok: false, error: `validate-proxy 호출 실패: ${msg}` }
  }

  if (!r.ok) {
    if (r.status === 401) return { ok: false, error: 'validate-proxy 인증 실패 (token 불일치)' }
    return { ok: false, error: `validate-proxy 응답 ${r.status}` }
  }

  try {
    return (await r.json()) as ValidateResult
  } catch {
    return { ok: false, error: 'validate-proxy 응답 파싱 실패' }
  }
}

async function syncOrders(
  _creds: CredentialPayload,
  _ctx: SyncContext
): Promise<{ ok: false; error: string; retryable: boolean }> {
  throw new Error('syncOrders must run on virtual server sync-worker (not Vercel)')
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
  syncOrders,
}
