-- Plan 14 Phase 12: 상세보기 모달을 키워드 단위로 확장
-- 매핑된 광고그룹의 각 키워드별 ad_stats 실측치 반환.

CREATE OR REPLACE FUNCTION get_category_keyword_details(
  p_brand_id uuid,
  p_category_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE (
  keyword_unit_id uuid,
  keyword_name text,
  ad_group_id text,
  ad_group_name text,
  campaign_name text,
  campaign_type text,
  cost numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  conversion_revenue numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH mapped_ad_groups AS (
    SELECT agcm.ad_group_id
    FROM ad_group_category_mappings agcm
    WHERE agcm.brand_id = p_brand_id AND agcm.category_id = p_category_id
  ),
  keyword_units AS (
    SELECT
      au.id AS keyword_unit_id,
      au.external_name AS keyword_name,
      (au.metadata->>'ad_group_id') AS ad_group_id,
      (au.metadata->>'ad_group_name') AS ad_group_name,
      au.parent_id AS campaign_unit_id
    FROM ad_units au
    JOIN mapped_ad_groups mag ON mag.ad_group_id = (au.metadata->>'ad_group_id')
    WHERE au.brand_id = p_brand_id
      AND au.level = 'keyword'
  ),
  campaigns AS (
    SELECT id, external_name, (metadata->>'type') AS campaign_type
    FROM ad_units
    WHERE brand_id = p_brand_id AND level = 'campaign'
  ),
  keyword_stats AS (
    SELECT
      ast.ad_unit_id,
      SUM(ast.cost) AS cost,
      SUM(ast.impressions)::bigint AS impressions,
      SUM(ast.clicks)::bigint AS clicks,
      SUM(ast.conversions)::bigint AS conversions,
      SUM(ast.conversion_revenue) AS conversion_revenue
    FROM ad_stats ast
    WHERE ast.brand_id = p_brand_id
      AND ast.date >= p_from AND ast.date <= p_to
    GROUP BY ast.ad_unit_id
  )
  SELECT
    ku.keyword_unit_id,
    ku.keyword_name,
    ku.ad_group_id,
    ku.ad_group_name,
    c.external_name AS campaign_name,
    c.campaign_type,
    COALESCE(ks.cost, 0) AS cost,
    COALESCE(ks.impressions, 0) AS impressions,
    COALESCE(ks.clicks, 0) AS clicks,
    COALESCE(ks.conversions, 0) AS conversions,
    COALESCE(ks.conversion_revenue, 0) AS conversion_revenue
  FROM keyword_units ku
  LEFT JOIN campaigns c ON c.id = ku.campaign_unit_id
  LEFT JOIN keyword_stats ks ON ks.ad_unit_id = ku.keyword_unit_id
  ORDER BY COALESCE(ks.cost, 0) DESC, ku.ad_group_name, ku.keyword_name;
$$;
