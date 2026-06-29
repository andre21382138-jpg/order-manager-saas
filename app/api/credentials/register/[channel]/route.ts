import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdapter } from '@/lib/adapters/_registry'

function errorRedirect(
  reqUrl: URL,
  brandId: string | null,
  channel: string,
  message: string
) {
  const target = brandId
    ? `/brands/${brandId}/settings/connections/${channel}/new?error=${encodeURIComponent(message)}`
    : `/brands?error=${encodeURIComponent(message)}`
  return NextResponse.redirect(new URL(target, reqUrl), { status: 303 })
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ channel: string }> }
) {
  const { channel } = await ctx.params
  const reqUrl = new URL(request.url)

  const form = await request.formData()
  const brandId = String(form.get('brand_id') ?? '').trim()
  const accountLabel = String(form.get('accountLabel') ?? '').trim()

  if (!brandId) {
    return NextResponse.redirect(
      new URL('/brands?error=invalid_brand', reqUrl),
      { status: 303 }
    )
  }
  if (!accountLabel) {
    return errorRedirect(reqUrl, brandId, channel, '계정 이름 (별칭)을 입력해주세요')
  }

  const adapter = getAdapter(channel)
  if (!adapter || adapter.authType !== 'api_key' || !adapter.buildPayload || !adapter.credentialFields) {
    return errorRedirect(reqUrl, brandId, channel, '지원하지 않는 매체입니다')
  }

  // 인증 + brand 소유 검증
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', reqUrl), { status: 303 })
  }
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()
  if (!brand) {
    return errorRedirect(reqUrl, null, channel, '브랜드를 찾을 수 없습니다')
  }

  // 어댑터의 credentialFields key별 formData 추출 (accountLabel 제외)
  const formValues: Record<string, string> = {}
  for (const field of adapter.credentialFields) {
    if (field.key === 'accountLabel') continue
    const v = String(form.get(field.key) ?? '').trim()
    if (!v) {
      return errorRedirect(reqUrl, brandId, channel, `${field.label} 필드를 입력해주세요`)
    }
    formValues[field.key] = v
  }

  // payload 빌드 + 즉시 검증
  const payload = adapter.buildPayload(formValues)
  const v = await adapter.validate(payload)
  if (!v.ok) {
    return errorRedirect(reqUrl, brandId, channel, v.error)
  }

  // Vault + brand_credentials INSERT
  const admin = createAdminClient()

  const { data: secretId, error: vaultErr } = await admin.rpc('create_vault_secret', {
    secret: JSON.stringify(payload),
    name: `${channel}:${brandId}:${accountLabel}`,
    description: `${brand.name} / ${accountLabel}`,
  })
  if (vaultErr || !secretId) {
    return errorRedirect(
      reqUrl,
      brandId,
      channel,
      `Vault 저장 실패: ${vaultErr?.message ?? 'unknown'}`
    )
  }

  const { error: insertErr } = await admin.from('brand_credentials').insert({
    brand_id: brandId,
    channel,
    channel_account: accountLabel,
    secret_id: secretId,
    status: 'active',
    metadata: {},
  })

  if (insertErr) {
    const msg =
      insertErr.code === '23505'
        ? '이 별칭은 같은 브랜드에 이미 등록되어 있습니다'
        : `자격증명 저장 실패: ${insertErr.message}`
    // best-effort: 방금 만든 vault secret 정리 (Plan 2의 delete wrapper 재사용)
    await admin.rpc('delete_vault_secret', { secret_id: secretId })
    return errorRedirect(reqUrl, brandId, channel, msg)
  }

  // 성공 → connections 페이지로
  return NextResponse.redirect(
    new URL(
      `/brands/${brandId}/settings/connections?connected=${encodeURIComponent(`${channel}:${accountLabel}`)}`,
      reqUrl
    ),
    { status: 303 }
  )
}
