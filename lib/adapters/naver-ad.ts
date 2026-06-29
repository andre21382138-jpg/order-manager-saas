import 'server-only'
import { createHmac } from 'crypto'
import type {
  ChannelAdapter,
  CredentialPayload,
  ValidateResult,
} from './_types'

const NAVERAD_BASE = 'https://api.searchad.naver.com'

function signHmac(
  method: string,
  uri: string,
  timestamp: string,
  secretKey: string
): string {
  return createHmac('sha256', secretKey)
    .update(`${timestamp}.${method}.${uri}`)
    .digest('base64')
}

function buildPayload(formValues: Record<string, string>): CredentialPayload {
  return {
    customerId: formValues.customerId,
    accessLicense: formValues.accessLicense,
    secretKey: formValues.secretKey,
  }
}

async function validate(creds: CredentialPayload): Promise<ValidateResult> {
  const customerId = String(creds.customerId ?? '')
  const accessLicense = String(creds.accessLicense ?? '')
  const secretKey = String(creds.secretKey ?? '')
  if (!customerId || !accessLicense || !secretKey) {
    return { ok: false, error: 'customerId/accessLicense/secretKey 필드 누락' }
  }

  const uri = '/ncc/campaigns'
  const timestamp = Date.now().toString()
  const signature = signHmac('GET', uri, timestamp, secretKey)

  let r: Response
  try {
    r = await fetch(`${NAVERAD_BASE}${uri}`, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': accessLicense,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error'
    return { ok: false, error: `네이버광고 호출 실패: ${msg}` }
  }

  if (r.ok) return { ok: true }
  if (r.status === 401 || r.status === 403) {
    return {
      ok: false,
      error: '키가 유효하지 않습니다. customer_id / access license / secret key 확인',
    }
  }
  const text = await r.text().catch(() => '')
  return { ok: false, error: `네이버광고 API 에러 (${r.status}): ${text.slice(0, 200)}` }
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
}
