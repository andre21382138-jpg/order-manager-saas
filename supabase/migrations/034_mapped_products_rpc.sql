-- Plan 14 Phase 8: 매핑 완료된 상품 조회 (상품구분 탭 상단 섹션)
-- catalog_products(카페24) 중 product_category_mappings에 상품코드가 있는 것.
-- 카테고리명도 함께 반환.

CREATE OR REPLACE FUNCTION get_mapped_products(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  product_no text,
  product_name text,
  price numeric,
  category_id uuid,
  category_name text
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH is_cafe24 AS (
    SELECT EXISTS (
      SELECT 1 FROM brand_credentials bc
      WHERE bc.brand_id = p_brand_id
        AND bc.channel = 'cafe24'
        AND bc.channel_account = p_mall
    ) AS ok
  )
  SELECT
    cp.product_no,
    cp.product_name,
    cp.price,
    pc.id AS category_id,
    pc.name AS category_name
  FROM catalog_products cp
  JOIN is_cafe24 ON is_cafe24.ok
  JOIN product_category_mappings m
    ON m.brand_id = cp.brand_id AND m.product_no = cp.product_no
  JOIN product_categories pc ON pc.id = m.category_id
  WHERE cp.brand_id = p_brand_id
  ORDER BY pc.name, cp.product_name;
$$;

-- 카페24 catalog 전체 상품 조회 (상품정보 탭용)
CREATE OR REPLACE FUNCTION get_catalog_products(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  catalog_product_id uuid,
  product_no text,
  product_name text,
  price numeric,
  cost numeric,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH is_cafe24 AS (
    SELECT EXISTS (
      SELECT 1 FROM brand_credentials bc
      WHERE bc.brand_id = p_brand_id
        AND bc.channel = 'cafe24'
        AND bc.channel_account = p_mall
    ) AS ok
  )
  SELECT
    cp.id AS catalog_product_id,
    cp.product_no,
    cp.product_name,
    cp.price,
    cp.cost,
    cp.updated_at
  FROM catalog_products cp
  JOIN is_cafe24 ON is_cafe24.ok
  WHERE cp.brand_id = p_brand_id
  ORDER BY cp.product_name;
$$;
