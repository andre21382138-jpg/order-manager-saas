import type { SupabaseClient } from '@supabase/supabase-js'

export type DateRange = { from: string; to: string }

export type ProductInfoRow = {
  catalogProductId: string | null
  productName: string
  price: number | null
  cost: number | null
}

export type UnmappedProductRow = {
  productNo: string
  productName: string
  price: number | null
  recentQty: number
  recentAmount: number
}

export type MappedProductRow = {
  productNo: string
  productName: string
  price: number | null
  categoryId: string
  categoryName: string
}

export type CatalogProductRow = {
  catalogProductId: string
  productNo: string
  productName: string
  price: number | null
  cost: number | null
  updatedAt: string
}

export type AdGroupRow = {
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  keywordCount: number
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

async function fetchAllPages<T>(
  supabase: SupabaseClient,
  rpcName: string,
  args: Record<string, unknown>,
  errorPrefix: string,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .rpc(rpcName, args)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${errorPrefix}: ${error.message}`)
    const chunk = (data ?? []) as T[]
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
    if (from > 100000) break // safety
  }
  return all
}

export async function getUnmappedProducts(
  supabase: SupabaseClient,
  brandId: string,
  mall: string
): Promise<UnmappedProductRow[]> {
  const data = await fetchAllPages<{
    product_no: string
    product_name: string
    price: number | string | null
    recent_qty: number | string
    recent_amount: number | string
  }>(supabase, 'get_unmapped_products', { p_brand_id: brandId, p_mall: mall }, '미매핑 상품 조회 실패')
  return data.map((r) => ({
    productNo: r.product_no,
    productName: r.product_name,
    price: r.price === null ? null : toNum(r.price),
    recentQty: Number(r.recent_qty ?? 0),
    recentAmount: toNum(r.recent_amount),
  }))
}

export async function getMappedProducts(
  supabase: SupabaseClient,
  brandId: string,
  mall: string
): Promise<MappedProductRow[]> {
  const data = await fetchAllPages<{
    product_no: string
    product_name: string
    price: number | string | null
    category_id: string
    category_name: string
  }>(supabase, 'get_mapped_products', { p_brand_id: brandId, p_mall: mall }, '매핑 상품 조회 실패')
  return data.map((r) => ({
    productNo: r.product_no,
    productName: r.product_name,
    price: r.price === null ? null : toNum(r.price),
    categoryId: r.category_id,
    categoryName: r.category_name,
  }))
}

export async function getCatalogProducts(
  supabase: SupabaseClient,
  brandId: string,
  mall: string
): Promise<CatalogProductRow[]> {
  const data = await fetchAllPages<{
    catalog_product_id: string
    product_no: string
    product_name: string
    price: number | string | null
    cost: number | string | null
    updated_at: string
  }>(supabase, 'get_catalog_products', { p_brand_id: brandId, p_mall: mall }, '상품 catalog 조회 실패')
  return data.map((r) => ({
    catalogProductId: r.catalog_product_id,
    productNo: r.product_no,
    productName: r.product_name,
    price: r.price === null ? null : toNum(r.price),
    cost: r.cost === null ? null : toNum(r.cost),
    updatedAt: r.updated_at,
  }))
}

export async function getAdGroups(
  supabase: SupabaseClient,
  brandId: string
): Promise<AdGroupRow[]> {
  const data = await fetchAllPages<{
    ad_group_id: string
    ad_group_name: string
    campaign_id: string
    campaign_name: string
    keyword_count: number
  }>(supabase, 'get_ad_groups', { p_brand_id: brandId }, '광고그룹 조회 실패')
  return data.map((r) => ({
    adGroupId: r.ad_group_id,
    adGroupName: r.ad_group_name ?? '',
    campaignId: r.campaign_id ?? '',
    campaignName: r.campaign_name ?? '',
    keywordCount: Number(r.keyword_count ?? 0),
  }))
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
