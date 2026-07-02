-- Plan 14 Phase 12: 결산조회 [상세보기] 모달용 RPC
-- 상품구분에 매칭된 광고그룹별 광고 성과 (기간 합계).

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
  WITH keyword_units AS (
    SELECT
      agcm.ad_group_id,
      (au.metadata->>'ad_group_name') AS ad_group_name,
      au.parent_id,
      au.id AS keyword_unit_id
    FROM ad_group_category_mappings agcm
    JOIN ad_units au
      ON au.brand_id = agcm.brand_id
     AND au.level = 'keyword'
     AND (au.metadata->>'ad_group_id') = agcm.ad_group_id
    WHERE agcm.brand_id = p_brand_id
      AND agcm.category_id = p_category_id
  ),
  campaigns AS (
    SELECT id, external_name FROM ad_units
    WHERE brand_id = p_brand_id AND level = 'campaign'
  ),
  ag_stats AS (
    SELECT
      ku.ad_group_id,
      MAX(ku.ad_group_name) AS ad_group_name,
      MAX(c.external_name) AS campaign_name,
      SUM(ast.cost) AS cost,
      SUM(ast.impressions)::bigint AS impressions,
      SUM(ast.clicks)::bigint AS clicks,
      SUM(ast.conversions)::bigint AS conversions,
      SUM(ast.conversion_revenue) AS conversion_revenue
    FROM keyword_units ku
    LEFT JOIN campaigns c ON c.id = ku.parent_id
    LEFT JOIN ad_stats ast
      ON ast.ad_unit_id = ku.keyword_unit_id
     AND ast.brand_id = p_brand_id
     AND ast.date >= p_from AND ast.date <= p_to
    GROUP BY ku.ad_group_id
  )
  SELECT
    ad_group_id,
    ad_group_name,
    campaign_name,
    COALESCE(cost, 0) AS cost,
    COALESCE(impressions, 0) AS impressions,
    COALESCE(clicks, 0) AS clicks,
    COALESCE(conversions, 0) AS conversions,
    COALESCE(conversion_revenue, 0) AS conversion_revenue
  FROM ag_stats
  ORDER BY COALESCE(cost, 0) DESC;
$$;
