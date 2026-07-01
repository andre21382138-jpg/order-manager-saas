// Plan 4 시점 stub registry — 실 sync 메서드는 Plan 5/6/7에서 추가
// 각 어댑터는 channel 식별자만 가지고 sync 메서드는 모두 없음 → worker가 skip

const https = require('https')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

function yesterdayKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000)
  return d.toISOString().slice(0, 10)
}

function todayKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// 스마트스토어 access_token in-process 캐시 (Plan 6)
const smartstoreTokenCache = new Map() // key = clientId, value = { accessToken, expiresAt (ms epoch) }

async function getSmartstoreToken(clientId, clientSecret) {
  const cached = smartstoreTokenCache.get(clientId)
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.accessToken
  }

  const timestamp = Date.now()
  const password = `${clientId}_${timestamp}`
  const hashed = bcrypt.hashSync(password, clientSecret)
  const sign = Buffer.from(hashed).toString('base64')
  const body = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: sign,
    grant_type: 'client_credentials',
    type: 'SELF',
  }).toString()

  const r = await httpsRequest(
    'https://api.commerce.naver.com/external/v1/oauth2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    body
  )

  if (r.status !== 200 || !r.data?.access_token) {
    throw new Error(`smartstore token 발급 실패 (${r.status}): ${JSON.stringify(r.data).slice(0, 200)}`)
  }
  const expiresIn = Number(r.data.expires_in ?? 3600)
  const expiresAt = Date.now() + expiresIn * 1000
  smartstoreTokenCache.set(clientId, { accessToken: r.data.access_token, expiresAt })
  return r.data.access_token
}

const CANCEL_STATUSES = ['CANCEL_DONE', 'RETURN_DONE', 'EXCHANGE_DONE', 'CANCEL_NOSHIPPING', 'CANCELED_BY_NOPAYMENT', 'CANCELED']

function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = { _raw: data } }
        resolve({ status: res.statusCode, data: parsed })
      })
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

// === Plan 7: 네이버 검색광고 helpers ===

function signNaverAd(secretKey, method, uriPath, timestamp) {
  const message = `${timestamp}.${method}.${uriPath}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

async function naverAdGet(uriPath, query, creds) {
  const timestamp = Date.now().toString()
  const signature = signNaverAd(creds.secretKey, 'GET', uriPath, timestamp)
  const qs = query ? '?' + new URLSearchParams(query).toString() : ''
  const url = `https://api.searchad.naver.com${uriPath}${qs}`
  return httpsRequest(url, {
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': creds.accessLicense,
      'X-Customer': creds.customerId,
      'X-Signature': signature,
      'Content-Type': 'application/json',
    },
  })
}

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const cafe24Adapter = {
  channel: 'cafe24',

  async refreshToken(creds) {
    const { appId, appSecret, mallId, refreshToken } = creds
    if (!appId || !appSecret || !mallId || !refreshToken) {
      return { ok: false, error: 'cafe24 자격증명 필수 필드 누락' }
    }
    const credBasic = Buffer.from(`${appId}:${appSecret}`).toString('base64')
    const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    let r
    try {
      r = await httpsRequest(
        `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credBasic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
        body
      )
    } catch (e) {
      return { ok: false, error: `네트워크 실패: ${e.message}` }
    }
    if (r.status !== 200 || !r.data?.access_token) {
      // 카페24 refresh_token 자체가 만료/회수된 경우 - retryable=false
      return {
        ok: false,
        error: `카페24 refresh 실패 (${r.status}): ${JSON.stringify(r.data).slice(0, 200)}`,
      }
    }
    return {
      ok: true,
      newPayload: {
        appId,
        appSecret,
        mallId,
        accessToken: r.data.access_token,
        refreshToken: r.data.refresh_token,
        expiresAt: r.data.expires_at,
      },
    }
  },

  // syncOrders — Task 6에서 추가

  async syncProducts(creds, ctx) {
    const { mallId, accessToken } = creds
    const brandId = ctx.brandId
    if (!mallId || !accessToken || !brandId) {
      return { ok: false, error: 'syncProducts: 필수 인자 누락', retryable: false }
    }

    const { createAdminClient } = require('./supabase')
    const admin = createAdminClient()

    let totalUpserted = 0
    let offset = 0
    const limit = 100

    while (true) {
      let r
      try {
        r = await httpsRequest(
          `https://${mallId}.cafe24api.com/api/v2/admin/products?shop_no=1&limit=${limit}&offset=${offset}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Cafe24-Api-Version': '2025-12-01',
            },
          }
        )
      } catch (e) {
        return { ok: false, error: `카페24 products 호출 실패: ${e.message}`, retryable: true }
      }

      if (r.status === 401) {
        return { ok: false, error: 'access_token 만료 (401)', retryable: true }
      }
      if (r.status !== 200) {
        return {
          ok: false,
          error: `카페24 products API 에러 (${r.status}): ${JSON.stringify(r.data).slice(0, 200)}`,
          retryable: true,
        }
      }

      const products = Array.isArray(r.data?.products) ? r.data.products : []
      if (products.length === 0) break

      const rows = products.map((p) => ({
        brand_id: brandId,
        product_no: String(p.product_no ?? p.product_code ?? ''),
        product_name: String(p.product_name ?? ''),
        price: Number(p.price ?? 0),
        supply_price: Number(p.supply_price ?? 0),
        retail_price: Number(p.retail_price ?? 0),
        small_image: String(p.list_image ?? p.small_image ?? p.detail_image ?? ''),
        summary_description: String(p.summary_description ?? ''),
        manufacturer: String(p.manufacturer_code ?? p.manufacturer_name ?? ''),
        weight: Number(p.product_weight ?? 0),
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertErr, count } = await admin
        .from('catalog_products')
        .upsert(rows, { onConflict: 'brand_id,product_no', count: 'exact' })

      if (upsertErr) {
        return {
          ok: false,
          error: `catalog_products upsert 실패: ${upsertErr.message}`,
          retryable: true,
        }
      }

      totalUpserted += count ?? rows.length

      const hasNext = Array.isArray(r.data?.links) && r.data.links.some((l) => l.rel === 'next')
      if (!hasNext) break
      offset += limit
    }

    return { ok: true, rowsUpserted: totalUpserted }
  },

  async syncOrders(creds, ctx) {
    const { mallId, accessToken } = creds
    const brandId = ctx.brandId
    const channelAccount = ctx.channelAccount
    if (!mallId || !accessToken || !brandId || !channelAccount) {
      return { ok: false, error: 'syncOrders: 필수 인자 누락', retryable: false }
    }

    const startDate = ctx.dateRangeStart || yesterdayKST()
    const endDate = ctx.dateRangeEnd || todayKST()

    const { createAdminClient } = require('./supabase')
    const admin = createAdminClient()

    let totalOrdersUpserted = 0
    let totalItemsInserted = 0
    let offset = 0
    const limit = 100

    while (true) {
      let r
      try {
        r = await httpsRequest(
          `https://${mallId}.cafe24api.com/api/v2/admin/orders?shop_no=1&start_date=${startDate}&end_date=${endDate}&limit=${limit}&offset=${offset}&embed=items`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Cafe24-Api-Version': '2025-12-01',
            },
          }
        )
      } catch (e) {
        return { ok: false, error: `카페24 orders 호출 실패: ${e.message}`, retryable: true }
      }

      if (r.status === 401) {
        return { ok: false, error: 'access_token 만료 (401)', retryable: true }
      }
      if (r.status !== 200) {
        return {
          ok: false,
          error: `카페24 orders API 에러 (${r.status}): ${JSON.stringify(r.data).slice(0, 200)}`,
          retryable: true,
        }
      }

      const orders = Array.isArray(r.data?.orders) ? r.data.orders : []
      if (orders.length === 0) break

      const orderRows = orders.map((o) => {
        const itemsArr = Array.isArray(o.items) ? o.items : []
        const totalQty = itemsArr.reduce((sum, it) => sum + Number(it.quantity ?? 0), 0)
        const cancelStatuses = ['CANCEL_DONE', 'RETURN_DONE', 'EXCHANGE_DONE', 'CANCEL_NOSHIPPING', 'CANCELED_BY_NOPAYMENT', 'CANCELED']
        const isCancelled = cancelStatuses.includes(o.order_status)
        // 옛 운영 코드(src/App.js L1044~1052) 동일 매핑 — actual_order_amount / initial_order_amount 객체 안의 payment_amount / order_price_amount
        const amountSource = isCancelled ? o.initial_order_amount : o.actual_order_amount
        const rawPayment = Number(amountSource?.payment_amount ?? 0)
        const originalAmount = Number(amountSource?.order_price_amount ?? 0)
        // 네이버페이 포인트 보정 (payment_amount는 네이버포인트 제외값)
        const isNaverPay = !isCancelled && o.order_place_id === 'NCHECKOUT'
        const naverPoint = isNaverPay
          ? (Number(o.naver_point ?? 0) || Math.max(0, originalAmount - rawPayment))
          : 0
        const totalAmount = rawPayment + naverPoint
        // 회원구매(member_id != null) vs 비회원, 신규(first_order='T') vs 재구매
        const memberId = o.member_id ? String(o.member_id) : null
        const isNew = o.first_order === 'T'
        return {
          brand_id: brandId,
          mall_type: channelAccount,
          order_no: String(o.order_id ?? ''),
          date: o.order_date ?? null,
          total_amount: totalAmount,
          total_qty: totalQty,
          original_amount: originalAmount,
          is_cancelled: isCancelled,
          is_new: isNew,
          naver_amount: naverPoint,
          member_id: memberId,
        }
      })

      const { data: savedOrders, error: upsertErr } = await admin
        .from('orders')
        .upsert(orderRows, { onConflict: 'brand_id,order_no' })
        .select('id, order_no')

      if (upsertErr) {
        return {
          ok: false,
          error: `orders upsert 실패: ${upsertErr.message}`,
          retryable: true,
        }
      }

      totalOrdersUpserted += savedOrders?.length ?? 0

      for (const saved of (savedOrders ?? [])) {
        const orig = orders.find((o) => String(o.order_id) === saved.order_no)
        if (!orig || !Array.isArray(orig.items)) continue

        await admin.from('order_items').delete().eq('order_id', saved.id)

        const itemRows = orig.items.map((it) => {
          const rawNo = String(it.product_no ?? it.product_code ?? '').trim()
          return {
            order_id: saved.id,
            product_no: rawNo === '' ? null : rawNo,
            product_name: String(it.product_name ?? ''),
            qty: Number(it.quantity ?? 0),
            amount: Number(it.product_price ?? 0),
          }
        })

        if (itemRows.length > 0) {
          const { error: itemErr } = await admin.from('order_items').insert(itemRows)
          if (itemErr) {
            return {
              ok: false,
              error: `order_items INSERT 실패: ${itemErr.message}`,
              retryable: true,
            }
          }
          totalItemsInserted += itemRows.length
        }
      }

      if (!r.data?.links?.some((l) => l.rel === 'next')) break
      offset += limit
    }

    return {
      ok: true,
      rowsUpserted: totalOrdersUpserted,
      meta: { items_inserted: totalItemsInserted },
    }
  },

  async syncAnalytics(creds, ctx) {
    const { mallId, accessToken } = creds
    const brandId = ctx.brandId
    const channelAccount = ctx.channelAccount
    if (!mallId || !accessToken || !brandId || !channelAccount) {
      return { ok: false, error: 'syncAnalytics: 필수 인자 누락', retryable: false }
    }

    // 기본 범위: 어제-30일 ~ 어제 (KST)
    const endDate = ctx.dateRangeEnd || yesterdayKST()
    const startDate =
      ctx.dateRangeStart ||
      (() => {
        const d = new Date(new Date(endDate).getTime() - 30 * 86400000)
        return d.toISOString().slice(0, 10)
      })()

    const base = 'https://ca-api.cafe24data.com'
    const query = `mall_id=${mallId}&shop_no=1&start_date=${startDate}&end_date=${endDate}`
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

    // 1. 일별 방문자 (visitors/view?date_type=date)
    let visitDaily
    try {
      visitDaily = await httpsRequest(`${base}/visitors/view?${query}&date_type=date`, { method: 'GET', headers })
    } catch (e) {
      return { ok: false, error: `analytics visitors 호출 실패: ${e.message}`, retryable: true }
    }
    if (visitDaily.status === 401) return { ok: false, error: 'access_token 만료 (401 analytics)', retryable: true }
    if (visitDaily.status !== 200) {
      return {
        ok: false,
        error: `analytics visitors API 에러 (${visitDaily.status}): ${JSON.stringify(visitDaily.data).slice(0, 200)}`,
        retryable: true,
      }
    }

    // 2. 유입경로 (visitpaths/domains)
    let inflows
    try {
      inflows = await httpsRequest(`${base}/visitpaths/domains?${query}`, { method: 'GET', headers })
    } catch (e) {
      return { ok: false, error: `analytics inflows 호출 실패: ${e.message}`, retryable: true }
    }
    if (inflows.status !== 200) {
      return {
        ok: false,
        error: `analytics inflows API 에러 (${inflows.status})`,
        retryable: true,
      }
    }

    // 응답 파싱 (실제 cafe24 analytics 응답: {view: [...]}, {domains: [...]})
    // 옛 App.js L2736 (analytics.visits?.view), L2745 (analytics.inflows?.domains) 확인
    const dailyItems = Array.isArray(visitDaily.data?.view)
      ? visitDaily.data.view
      : Array.isArray(visitDaily.data?.visitors)
      ? visitDaily.data.visitors
      : []
    const inflowItems = Array.isArray(inflows.data?.domains)
      ? inflows.data.domains
      : Array.isArray(inflows.data?.paths)
      ? inflows.data.paths
      : []
    const inflowJson = inflowItems.slice(0, 50)

    const { createAdminClient } = require('./supabase')
    const admin = createAdminClient()

    const rows = dailyItems.map((it) => {
      // date 형식: "2026-03-09T00:00+09:00" → "2026-03-09"
      const rawDate = String(it.date || it.stat_date || it.visit_date || '')
      const date = rawDate.slice(0, 10)
      const visitCount = Number(it.visit_count ?? it.total_visits ?? 0)
      const firstVisit = Number(it.first_visit_count ?? 0)
      const reVisit = Number(it.re_visit_count ?? 0)
      return {
        brand_id: brandId,
        channel_account: mallId,
        mall_type: channelAccount,
        date,
        total_visits: visitCount,
        // 신규 방문자를 unique로 매핑 (cafe24는 unique_visitor 별도 필드 없음)
        unique_visits: firstVisit > 0 ? firstVisit : visitCount - reVisit,
        metadata: { inflows: inflowJson },
        updated_at: new Date().toISOString(),
      }
    }).filter((r) => r.date)

    if (rows.length === 0) {
      return { ok: true, rowsUpserted: 0, meta: { days: 0, inflow_count: inflowJson.length } }
    }

    const { data, error: upsertErr } = await admin
      .from('visitors')
      .upsert(rows, { onConflict: 'brand_id,mall_type,date' })
      .select('id')

    if (upsertErr) {
      return { ok: false, error: `visitors upsert 실패: ${upsertErr.message}`, retryable: true }
    }

    return {
      ok: true,
      rowsUpserted: data?.length ?? 0,
      meta: { days: rows.length, inflow_count: inflowJson.length },
    }
  },
}

const smartstoreAdapter = {
  channel: 'smartstore',

  async syncOrders(creds, ctx) {
    const { clientId, clientSecret } = creds
    const brandId = ctx.brandId
    const channelAccount = ctx.channelAccount
    if (!clientId || !clientSecret || !brandId || !channelAccount) {
      return { ok: false, error: 'syncOrders: 필수 인자 누락', retryable: false }
    }

    const { createAdminClient } = require('./supabase')
    const admin = createAdminClient()

    let accessToken
    try {
      accessToken = await getSmartstoreToken(clientId, clientSecret)
    } catch (e) {
      return { ok: false, error: e.message, retryable: true }
    }

    const startDate = ctx.dateRangeStart || yesterdayKST()
    const endDate = ctx.dateRangeEnd || todayKST()

    // 일별 chunk 생성
    const chunks = []
    let cursor = new Date(startDate)
    const endD = new Date(endDate)
    while (cursor <= endD) {
      chunks.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor.getTime() + 86400000)
    }

    const allDetails = []
    for (const day of chunks) {
      const fromRaw = `${day}T00:00:00.000+09:00`
      const toRaw = `${day}T23:59:59.999+09:00`
      const from = encodeURIComponent(fromRaw).replace(/%2B/g, '%2B') // ensure + is encoded
      const to = encodeURIComponent(toRaw)
      const uri = `/external/v1/pay-order/seller/product-orders?from=${from}&to=${to}&limitCount=300`
      let r
      try {
        r = await httpsRequest(
          `https://api.commerce.naver.com${uri}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
      } catch (e) {
        return { ok: false, error: `smartstore orders 호출 실패 (${day}): ${e.message}`, retryable: true }
      }

      if (r.status === 401) {
        // 캐시 무효화 → 다음 polling에서 재발급
        smartstoreTokenCache.delete(clientId)
        return { ok: false, error: 'smartstore access_token 만료 (401)', retryable: true }
      }
      if (r.status !== 200) {
        return {
          ok: false,
          error: `smartstore API 에러 (${r.status}, ${day}): ${JSON.stringify(r.data).slice(0, 200)}`,
          retryable: true,
        }
      }

      const items = Array.isArray(r.data?.data?.contents) ? r.data.data.contents
                  : Array.isArray(r.data?.data) ? r.data.data
                  : []
      allDetails.push(...items)
      // 다음 day fetch 전 짧은 sleep (rate limit 안전)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    if (allDetails.length === 0) {
      return { ok: true, rowsUpserted: 0, meta: { items_inserted: 0 } }
    }

    // orderId로 그룹핑 (sync.js 라인 117~167 패턴)
    const orderMap = new Map()
    for (const detail of allDetails) {
      const po = detail.content?.productOrder || detail.productOrder
      const order = detail.content?.order || detail.order
      if (!po || !order) continue
      const orderId = order.orderId
      const isCancelled = CANCEL_STATUSES.includes(po.productOrderStatus)
      const paymentDate = (order.paymentDate || '').slice(0, 10)

      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          order_id: orderId,
          order_date: paymentDate,
          canceled: 'F',
          first_order: order.firstOrderYn === 'Y' ? 'T' : 'F',
          actual_amount: 0,
          initial_amount: 0,
          actual_original: 0,
          initial_original: 0,
          items: [],
        })
      }

      const grp = orderMap.get(orderId)
      const qty = Number(po.quantity || 1)
      const unitPrice = Number(po.unitPrice || 0)
      const totalPayAmt = Number(po.totalPaymentAmount || 0)
      const sellerStoreDc = Number(po.sellerBurdenStoreDiscountAmount || 0)
      const naverProdDc = Math.max(
        0,
        Number(po.productProductDiscountAmount || 0) - Number(po.sellerBurdenProductDiscountAmount || 0)
      )
      const totalAmt = totalPayAmt + sellerStoreDc + naverProdDc

      grp.items.push({
        product_no: String(po.productId || ''),
        product_name: po.productName || '상품',
        quantity: qty,
        order_price_amount: unitPrice,
      })

      if (isCancelled) {
        grp.initial_amount += totalAmt
        grp.initial_original += unitPrice * qty
        grp.canceled = 'T'
      } else {
        grp.actual_amount += totalAmt
        grp.actual_original += unitPrice * qty
      }
    }

    const groupedOrders = Array.from(orderMap.values())

    // upsert (sync.js 라인 174~210 패턴)
    let totalOrdersUpserted = 0
    let totalItemsInserted = 0
    const BATCH = 50

    for (let i = 0; i < groupedOrders.length; i += BATCH) {
      const batch = groupedOrders.slice(i, i + BATCH)
      const orderRows = batch.map((o) => {
        const isCancelled = o.canceled === 'T'
        const isNew = o.first_order === 'T'
        return {
          brand_id: brandId,
          mall_type: channelAccount,
          order_no: String(o.order_id),
          date: o.order_date,
          total_amount: isCancelled ? o.initial_amount : o.actual_amount,
          original_amount: isCancelled ? o.initial_original : o.actual_original,
          is_cancelled: isCancelled,
          is_new: isNew,
          total_qty: o.items.reduce((s, it) => s + Number(it.quantity ?? 0), 0) || 1,
          note: `${channelAccount} 자동수집`,
        }
      })

      const { data: savedOrders, error: upsertErr } = await admin
        .from('orders')
        .upsert(orderRows, { onConflict: 'brand_id,order_no' })
        .select('id, order_no')

      if (upsertErr) {
        return { ok: false, error: `orders upsert 실패: ${upsertErr.message}`, retryable: true }
      }

      totalOrdersUpserted += savedOrders?.length ?? 0

      for (const saved of (savedOrders ?? [])) {
        const orig = batch.find((o) => String(o.order_id) === saved.order_no)
        if (!orig) continue

        await admin.from('order_items').delete().eq('order_id', saved.id)

        const items = orig.items.length > 0
          ? orig.items
          : [{ product_name: '상품', quantity: 1, order_price_amount: 0 }]

        const itemRows = items.map((it) => {
          const rawNo = String(it.product_no ?? '').trim()
          return {
            order_id: saved.id,
            product_no: rawNo === '' ? null : rawNo,
            product_name: String(it.product_name ?? ''),
            category: '',
            qty: Number(it.quantity ?? 0),
            amount: Number(it.order_price_amount ?? 0),
          }
        })

        if (itemRows.length > 0) {
          const { error: itemErr } = await admin.from('order_items').insert(itemRows)
          if (itemErr) {
            return { ok: false, error: `order_items INSERT 실패: ${itemErr.message}`, retryable: true }
          }
          totalItemsInserted += itemRows.length
        }
      }
    }

    return {
      ok: true,
      rowsUpserted: totalOrdersUpserted,
      meta: { items_inserted: totalItemsInserted },
    }
  },
}

const naverAdAdapter = {
  channel: 'naver_ad',

  async syncAdStats(creds, ctx) {
    const { customerId, accessLicense, secretKey } = creds
    const brandId = ctx.brandId
    const channelAccount = ctx.channelAccount
    if (!customerId || !accessLicense || !secretKey || !brandId || !channelAccount) {
      return { ok: false, error: 'syncAdStats: 필수 인자 누락', retryable: false }
    }

    const { createAdminClient } = require('./supabase')
    const admin = createAdminClient()

    // 1. 날짜 범위 결정
    const startDate = ctx.dateRangeStart || yesterdayKST()
    const endDate = ctx.dateRangeEnd || ctx.dateRangeStart || yesterdayKST()
    const days = []
    {
      let cursor = new Date(`${startDate}T00:00:00Z`)
      const endD = new Date(`${endDate}T00:00:00Z`)
      while (cursor <= endD) {
        days.push(cursor.toISOString().slice(0, 10))
        cursor = new Date(cursor.getTime() + 86400000)
      }
    }

    const warnings = []

    // 2. /ncc/campaigns
    const campResp = await naverAdGet('/ncc/campaigns', null, { customerId, accessLicense, secretKey })
    if (campResp.status === 401) {
      return { ok: false, error: 'naver_ad 인증 실패 (401, campaigns)', retryable: true }
    }
    if (campResp.status !== 200) {
      return {
        ok: false,
        error: `campaigns 조회 실패 (${campResp.status}): ${JSON.stringify(campResp.data).slice(0, 200)}`,
        retryable: true,
      }
    }
    const campaignList = Array.isArray(campResp.data) ? campResp.data : []
    if (campaignList.length === 0) {
      return { ok: true, rowsUpserted: 0, meta: { ad_units_upserted: 0, ad_stats_upserted: 0, skipped_count: 0, warnings_count: 0 } }
    }
    const allCampaignIds = campaignList.map((c) => c.nccCampaignId).filter(Boolean)
    const idToCampaign = {}
    for (const c of campaignList) {
      if (c.nccCampaignId) idToCampaign[c.nccCampaignId] = { name: c.name || c.nccCampaignId, type: c.campaignTp || null }
    }

    // 3. days × campaign /stats — 전 캠페인 (cost=0 포함)
    const fields5 = JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt'])
    const fieldsCost = JSON.stringify(['salesAmt'])
    const campaignStatsByDay = {} // {day: {nccCampaignId: {impressions, clicks, cost, conversions, conversion_revenue}}}
    const sumCostByCampaign = {}
    const campChunks = chunkArray(allCampaignIds, 100)
    for (const day of days) {
      campaignStatsByDay[day] = {}
      for (const chunk of campChunks) {
        const r = await naverAdGet(
          '/stats',
          {
            ids: chunk.join(','),
            fields: fields5,
            timeRange: JSON.stringify({ since: day, until: day }),
            datePreset: 'custom',
          },
          { customerId, accessLicense, secretKey }
        )
        if (r.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, campaign stats)', retryable: true }
        if (r.status !== 200) {
          return { ok: false, error: `campaign stats 조회 실패 (${day}, ${r.status})`, retryable: true }
        }
        for (const it of (r.data?.data || [])) {
          const cost = Number(it.salesAmt || 0)
          campaignStatsByDay[day][it.id] = {
            impressions: Number(it.impCnt || 0),
            clicks: Number(it.clkCnt || 0),
            cost,
            conversions: Number(it.ccnt || 0),
            conversion_revenue: Number(it.convAmt || 0),
          }
          sumCostByCampaign[it.id] = (sumCostByCampaign[it.id] || 0) + cost
        }
      }
    }
    const activeCampaignIds = Object.keys(sumCostByCampaign).filter((id) => sumCostByCampaign[id] > 0)

    // 4. activeCampaignIds 별 /ncc/adgroups sequential
    const adgroupList = []
    const idToAdgroup = {} // adgroupId → {name, campaign_id}
    for (const cid of activeCampaignIds) {
      const r = await naverAdGet('/ncc/adgroups', { nccCampaignId: cid }, { customerId, accessLicense, secretKey })
      if (r.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, adgroups)', retryable: true }
      if (r.status !== 200) {
        warnings.push({ stage: 'adgroups', cid, status: r.status })
        continue
      }
      const arr = Array.isArray(r.data) ? r.data : []
      for (const g of arr) {
        if (g.nccAdgroupId) {
          adgroupList.push(g)
          idToAdgroup[g.nccAdgroupId] = { name: g.name || g.nccAdgroupId, campaign_id: g.nccCampaignId || cid }
        }
      }
    }
    const allAdgroupIds = adgroupList.map((g) => g.nccAdgroupId).filter(Boolean)

    // 5. adgroup ids chunk /stats 기간 합산 — activeAdgroupIds
    let activeAdgroupIds = []
    if (allAdgroupIds.length > 0) {
      const adgroupChunks = chunkArray(allAdgroupIds, 100)
      const adgroupCost = {}
      for (const chunk of adgroupChunks) {
        const r = await naverAdGet(
          '/stats',
          {
            ids: chunk.join(','),
            fields: fieldsCost,
            timeRange: JSON.stringify({ since: startDate, until: endDate }),
            datePreset: 'custom',
          },
          { customerId, accessLicense, secretKey }
        )
        if (r.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, adgroup stats)', retryable: true }
        if (r.status !== 200) {
          return { ok: false, error: `adgroup stats 조회 실패 (${r.status})`, retryable: true }
        }
        for (const it of (r.data?.data || [])) {
          adgroupCost[it.id] = (adgroupCost[it.id] || 0) + Number(it.salesAmt || 0)
        }
      }
      activeAdgroupIds = Object.keys(adgroupCost).filter((id) => adgroupCost[id] > 0)
    }

    // 6. activeAdgroupIds 별 /ncc/keywords sequential
    const keywordList = []
    const idToKeyword = {} // keywordId → {name, adgroup_id}
    for (const gid of activeAdgroupIds) {
      const r = await naverAdGet('/ncc/keywords', { nccAdgroupId: gid }, { customerId, accessLicense, secretKey })
      if (r.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, keywords)', retryable: true }
      if (r.status !== 200) {
        warnings.push({ stage: 'keywords', gid, status: r.status })
        continue
      }
      const arr = Array.isArray(r.data) ? r.data : []
      for (const k of arr) {
        if (k.nccKeywordId) {
          keywordList.push(k)
          idToKeyword[k.nccKeywordId] = { name: k.keyword || k.nccKeywordId, adgroup_id: k.nccAdgroupId || gid }
        }
      }
    }
    const allKeywordIds = keywordList.map((k) => k.nccKeywordId).filter(Boolean)

    // 7. keyword ids chunk /stats 기간 합산 — activeKeywordIds
    let activeKeywordIds = []
    if (allKeywordIds.length > 0) {
      const kwChunks = chunkArray(allKeywordIds, 100)
      const kwCost = {}
      for (const chunk of kwChunks) {
        const r = await naverAdGet(
          '/stats',
          {
            ids: chunk.join(','),
            fields: fieldsCost,
            timeRange: JSON.stringify({ since: startDate, until: endDate }),
            datePreset: 'custom',
          },
          { customerId, accessLicense, secretKey }
        )
        if (r.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, keyword period stats)', retryable: true }
        if (r.status !== 200) {
          return { ok: false, error: `keyword period stats 조회 실패 (${r.status})`, retryable: true }
        }
        for (const it of (r.data?.data || [])) {
          kwCost[it.id] = (kwCost[it.id] || 0) + Number(it.salesAmt || 0)
        }
      }
      activeKeywordIds = Object.keys(kwCost).filter((id) => kwCost[id] > 0)
    }

    // 8. days × activeKeyword chunk /stats full stats
    const keywordStatsByDay = {} // {day: {keywordId: {impressions, clicks, cost, ...}}}
    let kwStatTasks = 0
    let kwStatFails = 0
    if (activeKeywordIds.length > 0) {
      const kwChunks = chunkArray(activeKeywordIds, 100)
      for (const day of days) {
        keywordStatsByDay[day] = {}
        for (const chunk of kwChunks) {
          kwStatTasks++
          const r = await naverAdGet(
            '/stats',
            {
              ids: chunk.join(','),
              fields: fields5,
              timeRange: JSON.stringify({ since: day, until: day }),
              datePreset: 'custom',
            },
            { customerId, accessLicense, secretKey }
          )
          if (r.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, keyword day stats)', retryable: true }
          if (r.status !== 200) {
            kwStatFails++
            warnings.push({ stage: 'keyword_stats', day, status: r.status })
            continue
          }
          for (const it of (r.data?.data || [])) {
            const cost = Number(it.salesAmt || 0)
            if (cost > 0) {
              keywordStatsByDay[day][it.id] = {
                impressions: Number(it.impCnt || 0),
                clicks: Number(it.clkCnt || 0),
                cost,
                conversions: Number(it.ccnt || 0),
                conversion_revenue: Number(it.convAmt || 0),
              }
            }
          }
        }
      }
    }
    if (kwStatTasks > 0 && kwStatFails / kwStatTasks > 0.3) {
      return {
        ok: false,
        error: `keyword_stats 실패율 과다: ${kwStatFails}/${kwStatTasks}`,
        retryable: true,
      }
    }

    // 9-10. ad_units upsert (campaign 먼저, keyword는 parent_id 매핑)
    const campaignAdUnitRows = allCampaignIds.map((cid) => ({
      brand_id: brandId,
      channel: 'naver_ad',
      channel_account: channelAccount,
      external_id: cid,
      external_name: idToCampaign[cid]?.name || cid,
      level: 'campaign',
      parent_id: null,
      metadata: { type: idToCampaign[cid]?.type || null },
      active: true,
    }))

    const { data: savedCampaigns, error: campUpsertErr } = await admin
      .from('ad_units')
      .upsert(campaignAdUnitRows, { onConflict: 'brand_id,channel,external_id' })
      .select('id, external_id')

    if (campUpsertErr) {
      return { ok: false, error: `ad_units (campaign) upsert 실패: ${campUpsertErr.message}`, retryable: true }
    }
    const campaignDbIdMap = {}
    for (const row of (savedCampaigns || [])) campaignDbIdMap[row.external_id] = row.id

    // keyword rows
    const keywordAdUnitRows = []
    for (const kid of allKeywordIds) {
      const kw = idToKeyword[kid]
      if (!kw) continue
      const ag = idToAdgroup[kw.adgroup_id]
      if (!ag) continue
      const parentDbId = campaignDbIdMap[ag.campaign_id]
      if (!parentDbId) continue // campaign이 ad_units에 없으면 skip (드물지만 safety)
      keywordAdUnitRows.push({
        brand_id: brandId,
        channel: 'naver_ad',
        channel_account: channelAccount,
        external_id: kid,
        external_name: kw.name,
        level: 'keyword',
        parent_id: parentDbId,
        metadata: { ad_group_id: kw.adgroup_id, ad_group_name: ag.name },
        active: true,
      })
    }

    let savedKeywords = []
    if (keywordAdUnitRows.length > 0) {
      const { data, error: kwUpsertErr } = await admin
        .from('ad_units')
        .upsert(keywordAdUnitRows, { onConflict: 'brand_id,channel,external_id' })
        .select('id, external_id')
      if (kwUpsertErr) {
        return { ok: false, error: `ad_units (keyword) upsert 실패: ${kwUpsertErr.message}`, retryable: true }
      }
      savedKeywords = data || []
    }
    const keywordDbIdMap = {}
    for (const row of savedKeywords) keywordDbIdMap[row.external_id] = row.id

    const adUnitsUpserted = (savedCampaigns?.length || 0) + savedKeywords.length

    // 11. ad_stats upsert (campaign 전부 + keyword 일별 cost > 0)
    const statRows = []
    let skipped = 0
    for (const day of days) {
      // campaign stats — 전부 (cost=0 포함)
      for (const cid of allCampaignIds) {
        const unitDb = campaignDbIdMap[cid]
        if (!unitDb) { skipped++; continue }
        const s = campaignStatsByDay[day]?.[cid] || { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_revenue: 0 }
        statRows.push({
          brand_id: brandId,
          ad_unit_id: unitDb,
          date: day,
          impressions: s.impressions,
          clicks: s.clicks,
          cost: s.cost,
          conversions: s.conversions,
          conversion_revenue: s.conversion_revenue,
          metadata: {},
        })
      }
      // keyword stats — 일별 cost > 0만
      const dayKwStats = keywordStatsByDay[day] || {}
      for (const kid of Object.keys(dayKwStats)) {
        const unitDb = keywordDbIdMap[kid]
        if (!unitDb) { skipped++; continue }
        const s = dayKwStats[kid]
        statRows.push({
          brand_id: brandId,
          ad_unit_id: unitDb,
          date: day,
          impressions: s.impressions,
          clicks: s.clicks,
          cost: s.cost,
          conversions: s.conversions,
          conversion_revenue: s.conversion_revenue,
          metadata: {},
        })
      }
    }

    let adStatsUpserted = 0
    if (statRows.length > 0) {
      const BATCH = 200
      for (let i = 0; i < statRows.length; i += BATCH) {
        const batch = statRows.slice(i, i + BATCH)
        const { data, error: statErr } = await admin
          .from('ad_stats')
          .upsert(batch, { onConflict: 'ad_unit_id,date' })
          .select('id')
        if (statErr) {
          return { ok: false, error: `ad_stats upsert 실패: ${statErr.message}`, retryable: true }
        }
        adStatsUpserted += data?.length || 0
      }
    }

    return {
      ok: true,
      rowsUpserted: adStatsUpserted,
      meta: {
        ad_units_upserted: adUnitsUpserted,
        ad_stats_upserted: adStatsUpserted,
        skipped_count: skipped,
        warnings_count: warnings.length,
        days: days.length,
        active_campaigns: activeCampaignIds.length,
        active_keywords: activeKeywordIds.length,
      },
    }
  },

  async syncAdUnits(creds, ctx) {
    const { customerId, accessLicense, secretKey } = creds
    const brandId = ctx.brandId
    const channelAccount = ctx.channelAccount
    if (!customerId || !accessLicense || !secretKey || !brandId || !channelAccount) {
      return { ok: false, error: 'syncAdUnits: 필수 인자 누락', retryable: false }
    }

    const { createAdminClient } = require('./supabase')
    const admin = createAdminClient()

    const warnings = []

    // 1. campaigns
    const campResp = await naverAdGet('/ncc/campaigns', null, { customerId, accessLicense, secretKey })
    if (campResp.status === 401) return { ok: false, error: 'naver_ad 인증 실패 (401, campaigns)', retryable: true }
    if (campResp.status !== 200) {
      return { ok: false, error: `campaigns 조회 실패 (${campResp.status})`, retryable: true }
    }
    const campaignList = Array.isArray(campResp.data) ? campResp.data : []
    const allCampaignIds = campaignList.map((c) => c.nccCampaignId).filter(Boolean)
    const idToCampaign = {}
    for (const c of campaignList) {
      if (c.nccCampaignId) idToCampaign[c.nccCampaignId] = { name: c.name || c.nccCampaignId, type: c.campaignTp || null }
    }

    // 2. adgroups per campaign (전체)
    const adgroupList = []
    const idToAdgroup = {}
    for (const cid of allCampaignIds) {
      const r = await naverAdGet('/ncc/adgroups', { nccCampaignId: cid }, { customerId, accessLicense, secretKey })
      if (r.status !== 200) { warnings.push({ stage: 'adgroups', cid, status: r.status }); continue }
      const arr = Array.isArray(r.data) ? r.data : []
      for (const g of arr) {
        if (g.nccAdgroupId) {
          adgroupList.push(g)
          idToAdgroup[g.nccAdgroupId] = { name: g.name || g.nccAdgroupId, campaign_id: g.nccCampaignId || cid }
        }
      }
    }

    // 3. keywords per adgroup (전체)
    const keywordList = []
    const idToKeyword = {}
    for (const g of adgroupList) {
      const r = await naverAdGet('/ncc/keywords', { nccAdgroupId: g.nccAdgroupId }, { customerId, accessLicense, secretKey })
      if (r.status !== 200) { warnings.push({ stage: 'keywords', gid: g.nccAdgroupId, status: r.status }); continue }
      const arr = Array.isArray(r.data) ? r.data : []
      for (const k of arr) {
        if (k.nccKeywordId) {
          keywordList.push(k)
          idToKeyword[k.nccKeywordId] = { name: k.keyword || k.nccKeywordId, adgroup_id: k.nccAdgroupId || g.nccAdgroupId }
        }
      }
    }

    // 4. ad_units upsert — campaign 먼저
    const campaignRows = allCampaignIds.map((cid) => ({
      brand_id: brandId,
      channel: 'naver_ad',
      channel_account: channelAccount,
      external_id: cid,
      external_name: idToCampaign[cid]?.name || cid,
      level: 'campaign',
      parent_id: null,
      metadata: { type: idToCampaign[cid]?.type || null },
      active: true,
    }))

    const { data: savedCampaigns, error: campErr } = await admin
      .from('ad_units')
      .upsert(campaignRows, { onConflict: 'brand_id,channel,external_id' })
      .select('id, external_id')
    if (campErr) {
      return { ok: false, error: `ad_units (campaign) upsert 실패: ${campErr.message}`, retryable: true }
    }
    const campaignDbIdMap = {}
    for (const row of (savedCampaigns || [])) campaignDbIdMap[row.external_id] = row.id

    // keyword rows
    const keywordRows = []
    for (const k of keywordList) {
      const kw = idToKeyword[k.nccKeywordId]
      if (!kw) continue
      const ag = idToAdgroup[kw.adgroup_id]
      if (!ag) continue
      const parentDbId = campaignDbIdMap[ag.campaign_id]
      if (!parentDbId) continue
      keywordRows.push({
        brand_id: brandId,
        channel: 'naver_ad',
        channel_account: channelAccount,
        external_id: k.nccKeywordId,
        external_name: kw.name,
        level: 'keyword',
        parent_id: parentDbId,
        metadata: { ad_group_id: kw.adgroup_id, ad_group_name: ag.name },
        active: true,
      })
    }

    let savedKeywords = []
    if (keywordRows.length > 0) {
      const { data, error: kwErr } = await admin
        .from('ad_units')
        .upsert(keywordRows, { onConflict: 'brand_id,channel,external_id' })
        .select('id, external_id')
      if (kwErr) {
        return { ok: false, error: `ad_units (keyword) upsert 실패: ${kwErr.message}`, retryable: false }
      }
      savedKeywords = data || []
    }

    const totalUpserted = (savedCampaigns?.length || 0) + savedKeywords.length

    return {
      ok: true,
      rowsUpserted: totalUpserted,
      meta: {
        campaign_count: savedCampaigns?.length || 0,
        keyword_count: savedKeywords.length,
        warnings_count: warnings.length,
      },
    }
  },
}

const adapters = {
  cafe24: cafe24Adapter,
  smartstore: smartstoreAdapter,
  naver_ad: naverAdAdapter,
}

function getAdapter(channel) {
  return adapters[channel]
}

module.exports = { getAdapter }
