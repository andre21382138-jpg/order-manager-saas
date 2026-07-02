-- Plan 14 Phase 12 fix: 결산조회 광고비 산정을 캠페인 단위로 전환
-- 키워드 단위 합계는 쇼핑광고/브랜드검색 등 키워드 없는 캠페인 비용을 놓침.
-- 대신 각 광고그룹이 속한 캠페인의 total_cost를 광고그룹 매핑 수 비율로 분배.

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
  cat_total_ad_cost numeric
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
    COALESCE(cac.ad_cost, 0) AS cat_total_ad_cost
  FROM product_lines pl
  LEFT JOIN category_totals ct ON ct.category_id IS NOT DISTINCT FROM pl.category_id
  LEFT JOIN category_ad_costs cac ON cac.category_id = pl.category_id
  ORDER BY
    COALESCE(ct.total_amount, 0) DESC,
    pl.category_name NULLS LAST,
    pl.amount DESC,
    pl.option_value NULLS FIRST;
$$;

-- 상세보기 모달도 캠페인 단위 attribution
DROP FUNCTION IF EXISTS get_category_ad_group_details(uuid, uuid, date, date);
CREATE FUNCTION get_category_ad_group_details(
  p_brand_id uuid,
  p_category_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE (
  ad_group_id text,
  ad_group_name text,
  campaign_name text,
  cost numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  conversion_revenue numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH mapped_ad_groups AS (
    SELECT agcm.ad_group_id
    FROM ad_group_category_mappings agcm
    WHERE agcm.brand_id = p_brand_id
      AND agcm.category_id = p_category_id
  ),
  ag_meta AS (
    SELECT DISTINCT
      (au.metadata->>'ad_group_id') AS ad_group_id,
      (au.metadata->>'ad_group_name') AS ad_group_name,
      au.parent_id AS campaign_unit_id
    FROM ad_units au
    WHERE au.brand_id = p_brand_id
      AND au.level = 'keyword'
      AND (au.metadata->>'ad_group_id') IS NOT NULL
  ),
  campaigns AS (
    SELECT id, external_name FROM ad_units
    WHERE brand_id = p_brand_id AND level = 'campaign'
  ),
  campaign_mapping_counts AS (
    SELECT
      ag.campaign_unit_id,
      COUNT(DISTINCT mag.ad_group_id) AS mapped_count
    FROM mapped_ad_groups mag
    JOIN ag_meta ag ON ag.ad_group_id = mag.ad_group_id
    GROUP BY ag.campaign_unit_id
  ),
  campaign_stats AS (
    SELECT
      ast.ad_unit_id AS campaign_unit_id,
      SUM(ast.cost) AS cost,
      SUM(ast.impressions)::bigint AS impressions,
      SUM(ast.clicks)::bigint AS clicks,
      SUM(ast.conversions)::bigint AS conversions,
      SUM(ast.conversion_revenue) AS conversion_revenue
    FROM ad_stats ast
    JOIN ad_units au ON au.id = ast.ad_unit_id
    WHERE ast.brand_id = p_brand_id
      AND au.brand_id = p_brand_id
      AND au.level = 'campaign'
      AND ast.date >= p_from AND ast.date <= p_to
    GROUP BY ast.ad_unit_id
  )
  SELECT
    mag.ad_group_id,
    MAX(ag.ad_group_name) AS ad_group_name,
    MAX(c.external_name) AS campaign_name,
    COALESCE(SUM(cs.cost / cmc.mapped_count::numeric), 0) AS cost,
    COALESCE(SUM((cs.impressions::numeric) / cmc.mapped_count), 0)::bigint AS impressions,
    COALESCE(SUM((cs.clicks::numeric) / cmc.mapped_count), 0)::bigint AS clicks,
    COALESCE(SUM((cs.conversions::numeric) / cmc.mapped_count), 0)::bigint AS conversions,
    COALESCE(SUM(cs.conversion_revenue / cmc.mapped_count::numeric), 0) AS conversion_revenue
  FROM mapped_ad_groups mag
  JOIN ag_meta ag ON ag.ad_group_id = mag.ad_group_id
  LEFT JOIN campaigns c ON c.id = ag.campaign_unit_id
  LEFT JOIN campaign_mapping_counts cmc ON cmc.campaign_unit_id = ag.campaign_unit_id
  LEFT JOIN campaign_stats cs ON cs.campaign_unit_id = ag.campaign_unit_id
  GROUP BY mag.ad_group_id
  ORDER BY 4 DESC;
$$;
