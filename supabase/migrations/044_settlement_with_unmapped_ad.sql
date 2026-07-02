-- Plan 14 Phase 12 fix2: 결산조회에 '미매핑 광고비' 행 추가
-- 매핑된 카테고리 광고비 합계 + 미매핑 광고비 = 캠페인 총 광고비 (광고조회 총액과 일치)
-- 미매핑 광고비 = (모든 캠페인 총 광고비) - (매핑을 통해 카테고리에 attribute된 광고비)

DROP FUNCTION IF EXISTS get_settlement_report(uuid, text, date, date);
CREATE FUNCTION get_settlement_report(
  p_brand_id uuid,
  p_mall text,
  p_from date,
  p_to date
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  product_no text,
  product_name text,
  option_value text,
  qty bigint,
  amount numeric,
  cat_total_amount numeric,
  cat_total_ad_cost numeric,
  is_unmapped_ad_row boolean   -- 미매핑 광고비만 표시하는 pseudo row 마킹
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH product_lines AS (
    SELECT
      pcm.category_id,
      pc.name AS category_name,
      oi.product_no,
      oi.product_name,
      oi.option_value,
      SUM(oi.qty)::bigint AS qty,
      SUM(oi.amount) AS amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN product_category_mappings pcm
      ON pcm.brand_id = p_brand_id AND pcm.product_no = oi.product_no
    LEFT JOIN product_categories pc ON pc.id = pcm.category_id
    WHERE o.brand_id = p_brand_id
      AND (p_mall = 'all' OR o.mall_type = p_mall)
      AND o.date >= p_from AND o.date <= p_to
      AND o.is_cancelled = false
    GROUP BY pcm.category_id, pc.name, oi.product_no, oi.product_name, oi.option_value
  ),
  category_totals AS (
    SELECT category_id, SUM(amount) AS total_amount
    FROM product_lines GROUP BY category_id
  ),
  ag_campaigns AS (
    SELECT DISTINCT
      (au.metadata->>'ad_group_id') AS ad_group_id,
      au.parent_id AS campaign_unit_id
    FROM ad_units au
    WHERE au.brand_id = p_brand_id
      AND au.level = 'keyword'
      AND au.parent_id IS NOT NULL
      AND (au.metadata->>'ad_group_id') IS NOT NULL
  ),
  campaign_mapping_counts AS (
    SELECT
      agc.campaign_unit_id,
      COUNT(DISTINCT agcm.ad_group_id) AS mapped_count
    FROM ad_group_category_mappings agcm
    JOIN ag_campaigns agc ON agc.ad_group_id = agcm.ad_group_id
    WHERE agcm.brand_id = p_brand_id
    GROUP BY agc.campaign_unit_id
  ),
  campaign_costs AS (
    SELECT
      ast.ad_unit_id AS campaign_unit_id,
      SUM(ast.cost) AS cost
    FROM ad_stats ast
    JOIN ad_units au ON au.id = ast.ad_unit_id
    WHERE ast.brand_id = p_brand_id
      AND au.brand_id = p_brand_id
      AND au.level = 'campaign'
      AND ast.date >= p_from AND ast.date <= p_to
    GROUP BY ast.ad_unit_id
  ),
  category_ad_costs AS (
    SELECT
      agcm.category_id,
      SUM(cc.cost / cmc.mapped_count::numeric) AS ad_cost
    FROM ad_group_category_mappings agcm
    JOIN ag_campaigns agc ON agc.ad_group_id = agcm.ad_group_id
    JOIN campaign_mapping_counts cmc ON cmc.campaign_unit_id = agc.campaign_unit_id
    JOIN campaign_costs cc ON cc.campaign_unit_id = agc.campaign_unit_id
    WHERE agcm.brand_id = p_brand_id
    GROUP BY agcm.category_id
  ),
  totals AS (
    SELECT
      (SELECT COALESCE(SUM(cost), 0) FROM campaign_costs) AS all_campaign_cost,
      (SELECT COALESCE(SUM(ad_cost), 0) FROM category_ad_costs) AS mapped_ad_cost
  )
  SELECT
    pl.category_id,
    COALESCE(pl.category_name, '미분류') AS category_name,
    pl.product_no,
    pl.product_name,
    pl.option_value,
    pl.qty,
    pl.amount,
    COALESCE(ct.total_amount, 0) AS cat_total_amount,
    COALESCE(cac.ad_cost, 0) AS cat_total_ad_cost,
    false AS is_unmapped_ad_row
  FROM product_lines pl
  LEFT JOIN category_totals ct ON ct.category_id IS NOT DISTINCT FROM pl.category_id
  LEFT JOIN category_ad_costs cac ON cac.category_id = pl.category_id

  UNION ALL

  -- 미매핑 광고비 pseudo row
  SELECT
    NULL::uuid,
    '⚠️ 미매핑 광고비' AS category_name,
    NULL, NULL, NULL, 0::bigint, 0::numeric,
    0::numeric,
    GREATEST(totals.all_campaign_cost - totals.mapped_ad_cost, 0),
    true
  FROM totals
  WHERE totals.all_campaign_cost - totals.mapped_ad_cost > 0

  ORDER BY
    (category_name = '⚠️ 미매핑 광고비'),      -- 미매핑 광고비는 마지막
    cat_total_amount DESC NULLS LAST,
    category_name NULLS LAST,
    amount DESC NULLS LAST,
    option_value NULLS FIRST;
$$;
