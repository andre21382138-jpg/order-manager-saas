-- Plan 14 Phase 9: get_catalog_products / get_mapped_products / get_unmapped_products
-- catalog_products.channel_account 컬럼 반영. 몰별로 격리 조회.
-- 상품구분 매핑(product_category_mappings)은 아직 카페24 전용이라 mapped/unmapped RPC는 카페24만 지원.

DROP FUNCTION IF EXISTS get_catalog_products(uuid, text);
CREATE FUNCTION get_catalog_products(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  catalog_product_id uuid,
  product_no text,
  product_name text,
  price numeric,
  cost numeric,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    cp.id AS catalog_product_id,
    cp.product_no,
    cp.product_name,
    cp.price,
    cp.cost,
    cp.updated_at
  FROM catalog_products cp
  WHERE cp.brand_id = p_brand_id
    AND cp.channel_account = p_mall
  ORDER BY cp.product_name;
$$;

-- mapped/unmapped는 카페24만 (Excel 매핑이 카페24 전용)
DROP FUNCTION IF EXISTS get_mapped_products(uuid, text);
CREATE FUNCTION get_mapped_products(p_brand_id uuid, p_mall text)
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
    AND cp.channel_account = p_mall
  ORDER BY pc.name, cp.product_name;
$$;

DROP FUNCTION IF EXISTS get_unmapped_products(uuid, text);
CREATE FUNCTION get_unmapped_products(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  product_no text,
  product_name text,
  price numeric,
  recent_qty bigint,
  recent_amount numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH is_cafe24 AS (
    SELECT EXISTS (
      SELECT 1 FROM brand_credentials bc
      WHERE bc.brand_id = p_brand_id
        AND bc.channel = 'cafe24'
        AND bc.channel_account = p_mall
    ) AS ok
  ),
  cafe24_products AS (
    SELECT cp.product_no, cp.product_name, cp.price
    FROM catalog_products cp, is_cafe24
    WHERE cp.brand_id = p_brand_id
      AND cp.channel_account = p_mall
      AND is_cafe24.ok
  ),
  mapped_nos AS (
    SELECT product_no
    FROM product_category_mappings
    WHERE brand_id = p_brand_id
  ),
  recent_sales AS (
    SELECT oi.product_no,
           SUM(oi.qty)::bigint AS qty,
           SUM(oi.amount) AS amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND o.date >= CURRENT_DATE - INTERVAL '30 days'
      AND o.is_cancelled = false
      AND oi.product_no IS NOT NULL
    GROUP BY oi.product_no
  )
  SELECT
    cp.product_no,
    cp.product_name,
    cp.price,
    COALESCE(rs.qty, 0)::bigint,
    COALESCE(rs.amount, 0)
  FROM cafe24_products cp
  LEFT JOIN recent_sales rs ON rs.product_no = cp.product_no
  WHERE cp.product_no NOT IN (SELECT product_no FROM mapped_nos)
  ORDER BY COALESCE(rs.amount, 0) DESC, cp.product_name;
$$;
