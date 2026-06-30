import 'server-only'
import type {
  ChannelAdapter,
  CredentialPayload,
  ValidateResult,
  SyncContext,
} from './_types'

function buildPayload(formValues: Record<string, string>): CredentialPayload {
  return {
    customerId: formValues.customerId,
    accessLicense: formValues.accessLicense,
    secretKey: formValues.secretKey,
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
    r = await fetch(`${proxyUrl}/validate/naver_ad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': token,
      },
      body: JSON.stringify({
        customerId: creds.customerId,
        accessLicense: creds.accessLicense,
        secretKey: creds.secretKey,
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

export const naverAdAdapter: ChannelAdapter = {
  channel: 'naver_ad',
  category: 'ad',
  authType: 'api_key',
  credentialFields: [
    {
      key: 'accountLabel',
      label: '계정 이름 (별칭)',
      placeholder: '예: 주력광고계정',
    },
    {
      key: 'customerId',
      label: 'Customer ID',
      placeholder: '숫자',
      hint: '네이버광고 우측 상단 표시',
    },
    {
      key: 'accessLicense',
      label: 'Access License',
    },
    {
      key: 'secretKey',
      label: 'Secret Key',
      secret: true,
    },
  ],
  buildPayload,
  validate,
  syncAdStats,
  syncAdUnits,
}
