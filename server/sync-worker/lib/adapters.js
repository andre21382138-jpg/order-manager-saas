// Plan 4 시점 stub registry — 실 sync 메서드는 Plan 5/6/7에서 추가
// 각 어댑터는 channel 식별자만 가지고 sync 메서드는 모두 없음 → worker가 skip

const https = require('https')

function yesterdayKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000)
  return d.toISOString().slice(0, 10)
}

function todayKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

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
    if (!mallId || !accessToken || !brandId) {
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

      const orderRows = orders.map((o) => ({
        brand_id: brandId,
        order_no: String(o.order_id ?? ''),
        order_date: o.order_date ?? null,
        payment_date: o.payment_date ?? null,
        member_id: o.member_id ?? null,
        total_amount: Number(o.actual_payment_amount ?? o.order_price_amount ?? 0),
        status: o.order_status ?? '',
        synced_at: new Date().toISOString(),
      }))

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
          product_no: String(it.product_no ?? it.product_code ?? ''),
          variant_code: String(it.variants_code ?? ''),
          product_name: String(it.product_name ?? ''),
          quantity: Number(it.quantity ?? 0),
          price: Number(it.product_price ?? 0),
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
  // syncOrders/syncProducts — Plan 6에서 구현
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
