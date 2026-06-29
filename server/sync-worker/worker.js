require('dotenv').config()
const { createAdminClient } = require('./lib/supabase')
const { JOB_TYPE_TO_METHOD } = require('./lib/job-type-routing')
const { getAdapter } = require('./lib/adapters')

const POLL_INTERVAL_MS = 5000
const STALE_RUNNING_THRESHOLD_MIN = 10
const STALE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const MAX_RETRY = 3

const admin = createAdminClient()

function log(level, msg, extra) {
  const line = `[${new Date().toISOString()}] ${level} ${msg}`
  if (extra) console.log(line, JSON.stringify(extra))
  else console.log(line)
}

async function markCompleted(jobId, resultSummary) {
  await admin
    .from('sync_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result_summary: resultSummary,
    })
    .eq('id', jobId)
}

async function markFailed(jobId, retryCount, errorMessage, retryable) {
  const newRetry = (retryCount ?? 0) + 1
  const final = !retryable || newRetry >= MAX_RETRY
  await admin
    .from('sync_jobs')
    .update({
      status: final ? 'failed' : 'pending',
      completed_at: final ? new Date().toISOString() : null,
      started_at: final ? null : null,
      retry_count: newRetry,
      error_message: errorMessage,
    })
    .eq('id', jobId)
}

async function recoverStaleRunning() {
  try {
    const { data, error } = await admin.rpc('reset_stale_running', {
      threshold_minutes: STALE_RUNNING_THRESHOLD_MIN,
    })
    if (error) {
      log('ERROR', 'reset_stale_running failed', { msg: error.message })
      return
    }
    if (data && data > 0) log('INFO', `reset_stale_running: ${data} jobs returned to pending`)
  } catch (e) {
    log('ERROR', 'reset_stale_running exception', { msg: e.message })
  }
}

async function pollOnce() {
  let job
  try {
    const { data, error } = await admin.rpc('pick_pending_job')
    if (error) {
      log('ERROR', 'pick_pending_job failed', { msg: error.message })
      return
    }
    if (!data) return // no pending job
    job = data
  } catch (e) {
    log('ERROR', 'pick_pending_job exception', { msg: e.message })
    return
  }

  log('INFO', `picked job ${job.id} (${job.channel}/${job.job_type})`)

  try {
    // brand_credentials 조회
    const { data: cred, error: credErr } = await admin
      .from('brand_credentials')
      .select('id, brand_id, channel, channel_account, secret_id')
      .eq('id', job.credential_id)
      .single()
    if (credErr || !cred) {
      throw new Error(`credential ${job.credential_id} not found: ${credErr?.message ?? ''}`)
    }

    // Vault에서 자격증명 복호화
    const { data: secretText, error: vaultErr } = await admin.rpc('read_vault_secret', {
      secret_id: cred.secret_id,
    })
    if (vaultErr || !secretText) {
      throw new Error(`vault read failed: ${vaultErr?.message ?? 'empty'}`)
    }
    const creds = JSON.parse(secretText)

    // 어댑터 라우팅
    const adapter = getAdapter(job.channel)
    if (!adapter) {
      throw new Error(`unknown channel: ${job.channel}`)
    }
    const methodName = JOB_TYPE_TO_METHOD[job.job_type]
    if (!methodName) {
      throw new Error(`unknown job_type: ${job.job_type}`)
    }
    const method = adapter[methodName]
    if (typeof method !== 'function') {
      // Plan 4 시점: 미구현이라 skip
      await markCompleted(job.id, {
        skipped: true,
        reason: 'method_not_implemented',
        method: methodName,
      })
      log('INFO', `job ${job.id} skipped (method ${methodName} not implemented)`)
      return
    }

    // 실 sync 호출 (Plan 5+ 이후)
    const ctx = {
      brandId: job.brand_id,
      channelAccount: cred.channel_account,
      dateRangeStart: job.date_range_start,
      dateRangeEnd: job.date_range_end,
    }
    const result = await method(creds, ctx)

    if (result.ok) {
      await markCompleted(job.id, {
        rowsUpserted: result.rowsUpserted ?? 0,
        ...(result.meta ?? {}),
      })
      await admin
        .from('brand_credentials')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', cred.id)
      log('INFO', `job ${job.id} completed (rows: ${result.rowsUpserted ?? 0})`)
    } else {
      await markFailed(job.id, job.retry_count, result.error, result.retryable)
      log('WARN', `job ${job.id} failed`, { error: result.error })
    }
  } catch (e) {
    await markFailed(job.id, job.retry_count, e.message, true)
    log('ERROR', `job ${job.id} exception`, { msg: e.message })
  }
}

log('INFO', 'sync-worker starting')
recoverStaleRunning().then(() => {
  setInterval(pollOnce, POLL_INTERVAL_MS)
  setInterval(recoverStaleRunning, STALE_CHECK_INTERVAL_MS)
  pollOnce()
})
