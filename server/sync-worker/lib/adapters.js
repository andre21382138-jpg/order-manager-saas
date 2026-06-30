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
        return {
          brand_id: brandId,
          mall_type: channelAccount,
          order_no: String(o.order_id ?? ''),
          date: o.order_date ?? null,
          total_amount: Number(o.actual_payment_amount ?? o.order_price_amount ?? 0),
          total_qty: totalQty,
          original_amount: Number(o.order_price_amount ?? 0),
          is_cancelled: cancelStatuses.includes(o.order_status),
          is_new: false,
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

        const itemRows = orig.items.map((it) => ({
          order_id: saved.id,
          product_name: String(it.product_name ?? ''),
          qty: Number(it.quantity ?? 0),
          amount: Number(it.product_price ?? 0),
        }))

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

        const itemRows = items.map((it) => ({
          order_id: saved.id,
          product_name: String(it.product_name ?? ''),
          category: '',
          qty: Number(it.quantity ?? 0),
          amount: Number(it.order_price_amount ?? 0),
        }))

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
  // syncAdStats/syncAdUnits — Plan 7에서 구현
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
