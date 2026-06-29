import 'server-only'

export type Channel = 'cafe24' | 'smartstore' | 'naver_ad'
export type AuthType = 'oauth' | 'api_key'

export interface CredentialPayload {
  [key: string]: string | number | undefined
}

export interface GetAuthUrlInput {
  appId: string
  mallId: string
  state: string
  redirectUri: string
}

export interface HandleCallbackInput {
  code: string
  mallId: string
  appId: string
  appSecret: string
  redirectUri: string
}

export type ValidateResult = { ok: true } | { ok: false; error: string }

export interface FieldDef {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
  hint?: string
}

export interface ChannelAdapter {
  channel: Channel
  category: 'shop' | 'ad'
  authType: AuthType

  // OAuth 매체 (cafe24) — Plan 2
  getAuthUrl?(input: GetAuthUrlInput): string
  handleCallback?(input: HandleCallbackInput): Promise<CredentialPayload>

  // API 키 매체 (smartstore, naver_ad) — Plan 3
  credentialFields?: FieldDef[]
  buildPayload?(formValues: Record<string, string>): CredentialPayload

  // 공통
  validate(creds: CredentialPayload): Promise<ValidateResult>
}
