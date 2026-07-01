import type { SupabaseClient } from '@supabase/supabase-js'

export type DateRange = { from: string; to: string }

export type ProductInfoRow = {
  catalogProductId: string | null
  productName: string
  price: number | null
  cost: number | null
}

export type ProductSalesRow = {
  productName: string
  qty: number
  amount: number
  prevAmount: number
  share: number
  changePercent: number | null
  adCost: number
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function prevPeriodRange(range: DateRange): DateRange {
  // 이전 달 동기간: from/to 각각 1개월 전
  const shift = (d: string): string => {
    const dt = new Date(`${d}T00:00:00Z`)
    dt.setUTCMonth(dt.getUTCMonth() - 1)
    return dt.toISOString().slice(0, 10)
  }
  return { from: shift(range.from), to: shift(range.to) }
}

export async function getMallList(
  supabase: SupabaseClient,
  brandId: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_product_mall_list', {
    p_brand_id: brandId,
  })
  if (error) throw new Error(`mall list 조회 실패: ${error.message}`)
  return (data ?? []).map((r: { mall_type: string }) => r.mall_type)
}

export async function getProductInfo(
  supabase: SupabaseClient,
  brandId: string,
  mall: string
): Promise<ProductInfoRow[]> {
  const { data, error } = await supabase.rpc('get_product_info', {
    p_brand_id: brandId,
    p_mall: mall,
  })
  if (error) throw new Error(`상품정보 조회 실패: ${error.message}`)
  return (data ?? []).map(
    (r: {
      catalog_product_id: string | null
      product_name: string
      price: number | string | null
      cost: number | string | null
    }) => ({
      catalogProductId: r.catalog_product_id,
      productName: r.product_name,
      price: r.price === null ? null : toNum(r.price),
      cost: r.cost === null ? null : toNum(r.cost),
    })
  )
}

export async function getProductSales(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<ProductSalesRow[]> {
  const prev = prevPeriodRange(range)
  const { data, error } = await supabase.rpc('get_product_sales', {
    p_brand_id: brandId,
    p_mall: mall,
    p_from: range.from,
    p_to: range.to,
    p_prev_from: prev.from,
    p_prev_to: prev.to,
  })
  if (error) throw new Error(`판매 데이터 조회 실패: ${error.message}`)
  const rows = (data ?? []).map(
    (r: {
      product_name: string
      current_qty: number | string
      current_amount: number | string
      prev_amount: number | string
      ad_cost: number | string | null
    }) => ({
      productName: r.product_name,
      qty: Number(r.current_qty ?? 0),
      amount: toNum(r.current_amount),
      prevAmount: toNum(r.prev_amount),
      adCost: toNum(r.ad_cost),
    })
  )
  const totalAmount = rows.reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  return rows.map(
    (r: {
      productName: string
      qty: number
      amount: number
      prevAmount: number
      adCost: number
    }) => ({
      ...r,
      share: totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0,
      changePercent:
        r.prevAmount > 0 ? ((r.amount - r.prevAmount) / r.prevAmount) * 100 : null,
    })
  )
}

export type MappableProduct = {
  productName: string
}

// 특정 쇼핑몰에서 판매된 상품 리스트 (order_items DISTINCT + catalog_products for 자사몰)
export async function getMallProducts(
  supabase: SupabaseClient,
  brandId: string,
  mall: string
): Promise<MappableProduct[]> {
  const { data, error } = await supabase.rpc('get_product_info', {
    p_brand_id: brandId,
    p_mall: mall,
  })
  if (error) throw new Error(`상품 목록 조회 실패: ${error.message}`)
  return (data ?? []).map((r: { product_name: string }) => ({
    productName: r.product_name,
  }))
}

// 특정 광고 unit에 이미 매핑된 상품 (쇼핑몰별)
export async function getCampaignMappings(
  supabase: SupabaseClient,
  unitId: string
): Promise<{ mallType: string; productName: string }[]> {
  const { data, error } = await supabase
    .from('campaign_product_mappings')
    .select('mall_type, product_name')
    .eq('ad_unit_id', unitId)
  if (error) throw new Error(`매핑 조회 실패: ${error.message}`)
  return (data ?? []).map((r: { mall_type: string; product_name: string }) => ({
    mallType: r.mall_type,
    productName: r.product_name,
  }))
}
