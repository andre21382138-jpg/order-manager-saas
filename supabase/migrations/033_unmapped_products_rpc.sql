-- Plan 14 Phase 6: 미매핑 상품 조회 RPC
-- catalog_products(카페24 sync) 중 product_category_mappings에 상품코드가 없는 것.
-- 최근 30일 판매 수량/금액도 함께 반환하여 UI에서 정렬·우선순위 판단.
-- cafe24 mall_type에 한정 (catalog_products는 브랜드 전체이며 카페24만 sync 됨).

CREATE OR REPLACE FUNCTION get_unmapped_products(p_brand_id uuid, p_mall text)
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
    WHERE cp.brand_id = p_brand_id AND is_cafe24.ok
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
