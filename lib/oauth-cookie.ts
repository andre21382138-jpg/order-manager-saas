import 'server-only'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'cafe24_oauth_state'

export type Cafe24OAuthState = {
  brandId: string
  mallId: string
  appId: string
  appSecret: string
  nonce: string
}

function getKey(): Uint8Array {
  const secret = process.env.OAUTH_COOKIE_SECRET
  if (!secret) throw new Error('OAUTH_COOKIE_SECRET not set')
  return new TextEncoder().encode(secret)
}

export async function signOAuthState(payload: Cafe24OAuthState): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getKey())
}

export async function verifyOAuthState(token: string): Promise<Cafe24OAuthState> {
  const { payload } = await jwtVerify(token, getKey())
  const { brandId, mallId, appId, appSecret, nonce } = payload as Record<string, string>
  if (!brandId || !mallId || !appId || !appSecret || !nonce) {
    throw new Error('OAuth state payload incomplete')
  }
  return { brandId, mallId, appId, appSecret, nonce }
}

export const CAFE24_OAUTH_COOKIE = COOKIE_NAME
