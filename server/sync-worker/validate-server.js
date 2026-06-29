require('dotenv').config()
const http = require('http')
const https = require('https')
const bcrypt = require('bcryptjs')
const { createHmac } = require('crypto')

const PORT = Number(process.env.VALIDATE_PROXY_PORT || 3003)
const TOKEN = process.env.VALIDATE_PROXY_TOKEN

if (!TOKEN) {
  console.error('VALIDATE_PROXY_TOKEN not set')
  process.exit(1)
}

const NAVER_COMMERCE_BASE = 'https://api.commerce.naver.com'
const NAVERAD_BASE = 'https://api.searchad.naver.com'

function log(level, msg, extra) {
  const line = `[${new Date().toISOString()}] ${level} ${msg}`
  if (extra) console.log(line, JSON.stringify(extra))
  else console.log(line)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

async function validateSmartstore(body) {
  const clientId = String(body.clientId ?? '')
  const clientSecret = String(body.clientSecret ?? '')
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'clientId/clientSecret 누락' }
  }
  const timestamp = Date.now()
  const password = `${clientId}_${timestamp}`
  const hashed = bcrypt.hashSync(password, clientSecret)
  const sign = Buffer.from(hashed).toString('base64')
  const formBody = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: sign,
    grant_type: 'client_credentials',
    type: 'SELF',
  }).toString()

  let r
  try {
    r = await fetch(`${NAVER_COMMERCE_BASE}/external/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    })
  } catch (e) {
    return { ok: false, error: `네이버 commerce 호출 실패: ${e.message}` }
  }

  if (r.ok) {
    const data = await r.json().catch(() => null)
    if (data?.access_token) return { ok: true }
    return { ok: false, error: '응답에 access_token 없음' }
  }
  if (r.status === 400 || r.status === 401) {
    return { ok: false, error: 'Client ID 또는 Secret이 올바르지 않습니다' }
  }
  const text = await r.text().catch(() => '')
  return { ok: false, error: `스마트스토어 API 에러 (${r.status}): ${text.slice(0, 200)}` }
}

function signHmac(method, uri, timestamp, secretKey) {
  return createHmac('sha256', secretKey)
    .update(`${timestamp}.${method}.${uri}`)
    .digest('base64')
}

async function validateNaverAd(body) {
  const customerId = String(body.customerId ?? '')
  const accessLicense = String(body.accessLicense ?? '')
  const secretKey = String(body.secretKey ?? '')
  if (!customerId || !accessLicense || !secretKey) {
    return { ok: false, error: 'customerId/accessLicense/secretKey 누락' }
  }
  const uri = '/ncc/campaigns'
  const timestamp = Date.now().toString()
  const signature = signHmac('GET', uri, timestamp, secretKey)

  let r
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
    return { ok: false, error: `네이버광고 호출 실패: ${e.message}` }
  }

  if (r.ok) return { ok: true }
  if (r.status === 401 || r.status === 403) {
    return { ok: false, error: '키가 유효하지 않습니다. customer_id / access license / secret key 확인' }
  }
  const text = await r.text().catch(() => '')
  return { ok: false, error: `네이버광고 API 에러 (${r.status}): ${text.slice(0, 200)}` }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'method not allowed' })
  }

  if (req.headers['x-proxy-token'] !== TOKEN) {
    return send(res, 401, { error: 'unauthorized' })
  }

  const m = req.url.match(/^\/validate\/(smartstore|naver_ad)\/?$/)
  if (!m) {
    return send(res, 404, { error: 'unknown channel' })
  }
  const channel = m[1]

  let body
  try {
    const raw = await readBody(req)
    body = JSON.parse(raw)
  } catch {
    return send(res, 400, { error: 'invalid json' })
  }

  try {
    const result = channel === 'smartstore'
      ? await validateSmartstore(body)
      : await validateNaverAd(body)
    log('INFO', `validated ${channel}: ${result.ok ? 'OK' : 'FAIL'}`)
    return send(res, 200, result)
  } catch (e) {
    log('ERROR', `validate ${channel} exception`, { msg: e.message })
    return send(res, 500, { ok: false, error: e.message })
  }
})

server.listen(PORT, () => {
  log('INFO', `validate-proxy listening on ${PORT}`)
})
