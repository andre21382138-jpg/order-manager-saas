import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ credentialId: string }> }
) {
  const { credentialId } = await ctx.params
  const reqUrl = new URL(request.url)

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', reqUrl), { status: 303 })
  }

  // RLS로 본인 brand의 credential만 조회 가능
  const { data: cred } = await supabase
    .from('brand_credentials')
    .select('id, brand_id, channel, channel_account, secret_id')
    .eq('id', credentialId)
    .single()

  if (!cred) {
    return NextResponse.redirect(
      new URL('/brands?error=credential_not_found', reqUrl),
      { status: 303 }
    )
  }

  const admin = createAdminClient()

  // 1. brand_credentials 삭제 (RLS로 본인 것만)
  const { error: delErr } = await admin
    .from('brand_credentials')
    .delete()
    .eq('id', credentialId)

  if (delErr) {
    return NextResponse.redirect(
      new URL(
        `/brands/${cred.brand_id}/settings/connections?error=${encodeURIComponent('자격증명 삭제 실패: ' + delErr.message)}`,
        reqUrl
      ),
      { status: 303 }
    )
  }

  // 2. Vault secret 정리 (실패해도 brand_credentials는 삭제됨 — best-effort)
  // vault schema는 PostgREST에 expose 안 되므로 public wrapper 호출
  if (cred.secret_id) {
    await admin.rpc('delete_vault_secret', { secret_id: cred.secret_id })
    // 실패 시 로그만, 사용자에게 영향 없음
  }

  return NextResponse.redirect(
    new URL(
      `/brands/${cred.brand_id}/settings/connections?disconnected=${encodeURIComponent(cred.channel_account)}`,
      reqUrl
    ),
    { status: 303 }
  )
}
