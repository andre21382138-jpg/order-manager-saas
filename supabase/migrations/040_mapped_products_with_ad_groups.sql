-- Plan 14 Phase 11: get_mapped_products에 광고그룹 컬럼 추가
-- 각 상품(product_no)에 매핑된 상품구분과, 그 상품구분에 매칭된 광고그룹 이름들을 함께 반환.

DROP FUNCTION IF EXISTS get_mapped_products(uuid, text);
CREATE FUNCTION get_mapped_products(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  product_no text,
  product_name text,
  price numeric,
  category_id uuid,
  category_name text,
  ad_group_names text
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH is_cafe24 AS (
    SELECT EXISTS (
      SELECT 1 FROM brand_credentials bc
      WHERE bc.brand_id = p_brand_id
        AND bc.channel = 'cafe24'
        AND bc.channel_account = p_mall
    ) AS ok
  ),
  -- 각 카테고리에 매핑된 광고그룹 이름들
  cat_ad_groups AS (
    SELECT
      agcm.category_id,
      string_agg(DISTINCT ag.name, ', ' ORDER BY ag.name) AS names
    FROM ad_group_category_mappings agcm
    JOIN LATERAL (
      SELECT DISTINCT (au.metadata->>'ad_group_name') AS name
      FROM ad_units au
      WHERE au.brand_id = agcm.brand_id
        AND au.level = 'keyword'
        AND (au.metadata->>'ad_group_id') = agcm.ad_group_id
      LIMIT 1
    ) ag ON true
    WHERE agcm.brand_id = p_brand_id
    GROUP BY agcm.category_id
  )
  SELECT
    cp.product_no,
    cp.product_name,
    cp.price,
    pc.id AS category_id,
    pc.name AS category_name,
    COALESCE(cag.names, '') AS ad_group_names
  FROM catalog_products cp
  JOIN is_cafe24 ON is_cafe24.ok
  JOIN product_category_mappings m
    ON m.brand_id = cp.brand_id AND m.product_no = cp.product_no
  JOIN product_categories pc ON pc.id = m.category_id
  LEFT JOIN cat_ad_groups cag ON cag.category_id = pc.id
  WHERE cp.brand_id = p_brand_id
    AND cp.channel_account = p_mall
  ORDER BY pc.name, cp.product_name;
$$;
