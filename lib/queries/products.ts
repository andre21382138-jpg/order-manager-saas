import type { SupabaseClient } from '@supabase/supabase-js'

export type DateRange = { from: string; to: string }

export type ProductInfoRow = {
  catalogProductId: string | null
  productName: string
  price: number | null
  cost: number | null
}

export type CategorySalesRow = {
  categoryId: string | null
  categoryName: string
  qty: number
  amount: number
  prevAmount: number
  costTotal: number
  adCost: number
  productCount: number
  share: number
  changePercent: number | null
  costRate: number | null
  adRate: number | null
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function prevPeriodRange(range: DateRange): DateRange {
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

export async function getCategorySales(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<CategorySalesRow[]> {
  const prev = prevPeriodRange(range)
  const { data, error } = await supabase.rpc('get_product_sales', {
    p_brand_id: brandId,
    p_mall: mall,
    p_from: range.from,
    p_to: range.to,
    p_prev_from: prev.from,
    p_prev_to: prev.to,
  })
  if (error) throw new Error(`카테고리 판매 조회 실패: ${error.message}`)

  const raw = (data ?? []).map(
    (r: {
      category_id: string | null
      category_name: string
      qty: number | string
      amount: number | string
      prev_amount: number | string
      cost_total: number | string | null
      ad_cost: number | string | null
      product_count: number | string
    }) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      qty: Number(r.qty ?? 0),
      amount: toNum(r.amount),
      prevAmount: toNum(r.prev_amount),
      costTotal: toNum(r.cost_total),
      adCost: toNum(r.ad_cost),
      productCount: Number(r.product_count ?? 0),
    })
  )

  const totalAmount = raw.reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  return raw.map((r: {
    categoryId: string | null
    categoryName: string
    qty: number
    amount: number
    prevAmount: number
    costTotal: number
    adCost: number
    productCount: number
  }) => ({
    ...r,
    share: totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0,
    changePercent:
      r.prevAmount > 0 ? ((r.amount - r.prevAmount) / r.prevAmount) * 100 : null,
    costRate: r.amount > 0 && r.costTotal > 0 ? (r.costTotal / r.amount) * 100 : null,
    adRate: r.amount > 0 && r.adCost > 0 ? (r.adCost / r.amount) * 100 : null,
  }))
}
