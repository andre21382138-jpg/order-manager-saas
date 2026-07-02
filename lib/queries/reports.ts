import type { SupabaseClient } from '@supabase/supabase-js'

export type DateRange = { from: string; to: string }

export type SettlementRow = {
  categoryId: string | null
  categoryName: string
  productNo: string | null
  productName: string
  optionValue: string | null
  qty: number
  amount: number
  catTotalAmount: number
  catTotalAdCost: number
  isUnmappedAdRow: boolean
}

export type AdGroupDetailRow = {
  adGroupId: string
  adGroupName: string
  campaignName: string
  cost: number
  impressions: number
  clicks: number
  conversions: number
  conversionRevenue: number
}

function toNum(v: number | string | null | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

export async function getSettlementReport(
  supabase: SupabaseClient,
  brandId: string,
  mall: string,
  range: DateRange
): Promise<SettlementRow[]> {
  const PAGE = 1000
  const all: SettlementRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .rpc('get_settlement_report', {
        p_brand_id: brandId,
        p_mall: mall,
        p_from: range.from,
        p_to: range.to,
      })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`결산 조회 실패: ${error.message}`)
    const chunk = (data ?? []) as Array<{
      category_id: string | null
      category_name: string
      product_no: string | null
      product_name: string
      option_value: string | null
      qty: number | string
      amount: number | string
      cat_total_amount: number | string
      cat_total_ad_cost: number | string
      is_unmapped_ad_row: boolean | null
    }>
    for (const r of chunk) {
      all.push({
        categoryId: r.category_id,
        categoryName: r.category_name,
        productNo: r.product_no,
        productName: r.product_name,
        optionValue: r.option_value,
        qty: Number(r.qty ?? 0),
        amount: toNum(r.amount),
        catTotalAmount: toNum(r.cat_total_amount),
        catTotalAdCost: toNum(r.cat_total_ad_cost),
        isUnmappedAdRow: r.is_unmapped_ad_row === true,
      })
    }
    if (chunk.length < PAGE) break
    from += PAGE
    if (from > 200000) break
  }
  return all
}

export async function getCategoryAdGroupDetails(
  supabase: SupabaseClient,
  brandId: string,
  categoryId: string,
  range: DateRange
): Promise<AdGroupDetailRow[]> {
  const { data, error } = await supabase.rpc('get_category_ad_group_details', {
    p_brand_id: brandId,
    p_category_id: categoryId,
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(`광고그룹 상세 조회 실패: ${error.message}`)
  return ((data ?? []) as Array<{
    ad_group_id: string
    ad_group_name: string
    campaign_name: string
    cost: number | string
    impressions: number | string
    clicks: number | string
    conversions: number | string
    conversion_revenue: number | string
  }>).map((r) => ({
    adGroupId: r.ad_group_id,
    adGroupName: r.ad_group_name ?? '',
    campaignName: r.campaign_name ?? '',
    cost: toNum(r.cost),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    conversionRevenue: toNum(r.conversion_revenue),
  }))
}
