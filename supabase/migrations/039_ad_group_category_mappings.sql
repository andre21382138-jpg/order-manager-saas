-- Plan 14 Phase 11: 광고그룹 ↔ 상품구분 매칭 테이블 + 조회 RPC
-- 캠페인보다 더 세밀한 광고그룹 단위로 상품구분과 매핑.
-- ad_group_id는 ad_units.metadata->>'ad_group_id' (키워드 rows에 저장됨).

-- 1) 매핑 테이블
CREATE TABLE IF NOT EXISTS ad_group_category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  ad_group_id text NOT NULL,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, ad_group_id)
);

CREATE INDEX IF NOT EXISTS idx_agcm_brand_group
  ON ad_group_category_mappings(brand_id, ad_group_id);
CREATE INDEX IF NOT EXISTS idx_agcm_category
  ON ad_group_category_mappings(category_id);

ALTER TABLE ad_group_category_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agcm_owner ON ad_group_category_mappings;
CREATE POLICY agcm_owner ON ad_group_category_mappings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = ad_group_category_mappings.brand_id AND brands.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = ad_group_category_mappings.brand_id AND brands.owner_id = auth.uid()
  ));

-- 2) 광고그룹 목록 조회 RPC (매칭 대상 리스트)
-- 키워드 rows의 metadata에서 (ad_group_id, ad_group_name) 뽑아 distinct + parent 캠페인 조인
CREATE OR REPLACE FUNCTION get_ad_groups(p_brand_id uuid)
RETURNS TABLE (
  ad_group_id text,
  ad_group_name text,
  campaign_id text,
  campaign_name text,
  keyword_count integer
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH keyword_groups AS (
    SELECT
      (au.metadata->>'ad_group_id') AS ad_group_id,
      (au.metadata->>'ad_group_name') AS ad_group_name,
      au.parent_id AS parent_id,
      au.id AS keyword_unit_id
    FROM ad_units au
    WHERE au.brand_id = p_brand_id
      AND au.level = 'keyword'
      AND (au.metadata->>'ad_group_id') IS NOT NULL
  ),
  campaigns AS (
    SELECT au.id, au.external_id, au.external_name
    FROM ad_units au
    WHERE au.brand_id = p_brand_id
      AND au.level = 'campaign'
  )
  SELECT
    kg.ad_group_id,
    MAX(kg.ad_group_name) AS ad_group_name,
    MAX(c.external_id) AS campaign_id,
    MAX(c.external_name) AS campaign_name,
    COUNT(DISTINCT kg.keyword_unit_id)::integer AS keyword_count
  FROM keyword_groups kg
  LEFT JOIN campaigns c ON c.id = kg.parent_id
  GROUP BY kg.ad_group_id
  ORDER BY MAX(c.external_name), MAX(kg.ad_group_name);
$$;
