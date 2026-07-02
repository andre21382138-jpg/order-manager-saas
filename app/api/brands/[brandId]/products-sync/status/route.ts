import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await ctx.params
  const url = new URL(request.url)
  const mall = url.searchParams.get('mall') ?? ''
  if (!mall) return NextResponse.json({ error: 'mall 필수' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: cred } = await supabase
    .from('brand_credentials')
    .select('id')
    .eq('brand_id', brandId)
    .eq('channel', 'cafe24')
    .eq('channel_account', mall)
    .single()
  if (!cred) {
    return NextResponse.json({ latest: null })
  }

  const { data: latest } = await supabase
    .from('sync_jobs')
    .select('id, status, started_at, completed_at, error_message, result_summary, created_at')
    .eq('brand_id', brandId)
    .eq('credential_id', cred.id)
    .eq('job_type', 'products')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ latest: latest ?? null })
}
