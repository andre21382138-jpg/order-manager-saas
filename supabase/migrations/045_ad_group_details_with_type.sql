-- Plan 14 Phase 12: 상세보기 모달에 광고영역(캠페인 type) 컬럼 추가

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
  campaign_type text,
  cost numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  conversion_revenue numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH mapped_ad_groups AS (
    SELECT agcm.ad_group_id FROM ad_group_category_mappings agcm
    WHERE agcm.brand_id = p_brand_id AND agcm.category_id = p_category_id
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
    SELECT
      id,
      external_name,
      (metadata->>'type') AS campaign_type
    FROM ad_units
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
    MAX(c.campaign_type) AS campaign_type,
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
  ORDER BY 5 DESC;
$$;
