-- Plan 12: get_product_sales에 ad_cost 컬럼 추가
-- campaign_product_mappings로 매핑된 캠페인의 ad_stats.cost 합산 (기간 필터)

DROP FUNCTION IF EXISTS get_product_sales(uuid, text, date, date, date, date);
CREATE FUNCTION get_product_sales(
  p_brand_id uuid,
  p_mall text,
  p_from date,
  p_to date,
  p_prev_from date,
  p_prev_to date
)
RETURNS TABLE (
  product_name text,
  current_qty bigint,
  current_amount numeric,
  prev_amount numeric,
  ad_cost numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH product_universe AS (
    SELECT cp.product_name
    FROM catalog_products cp
    WHERE cp.brand_id = p_brand_id AND p_mall = '자사몰'
    UNION
    SELECT DISTINCT oi.product_name
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND oi.product_name IS NOT NULL
      AND oi.product_name != ''
  ),
  current_sales AS (
    SELECT oi.product_name,
           SUM(oi.qty)::bigint AS qty,
           SUM(oi.amount) AS amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND o.date >= p_from AND o.date <= p_to
      AND o.is_cancelled = false
    GROUP BY oi.product_name
  ),
  prev_sales AS (
    SELECT oi.product_name,
           SUM(oi.amount) AS amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND o.date >= p_prev_from AND o.date <= p_prev_to
      AND o.is_cancelled = false
    GROUP BY oi.product_name
  ),
  ad_cost_per_product AS (
    -- 상품별 광고비 = 매핑된 모든 캠페인의 광고비 합산 (기간 필터)
    SELECT cpm.product_name,
           SUM(ast.cost) AS cost
    FROM campaign_product_mappings cpm
    JOIN ad_stats ast ON ast.ad_unit_id = cpm.ad_unit_id
    WHERE cpm.brand_id = p_brand_id
      AND cpm.mall_type = p_mall
      AND ast.brand_id = p_brand_id
      AND ast.date >= p_from AND ast.date <= p_to
    GROUP BY cpm.product_name
  )
  SELECT
    pu.product_name,
    COALESCE(cs.qty, 0) AS current_qty,
    COALESCE(cs.amount, 0) AS current_amount,
    COALESCE(ps.amount, 0) AS prev_amount,
    COALESCE(acp.cost, 0) AS ad_cost
  FROM product_universe pu
  LEFT JOIN current_sales cs ON cs.product_name = pu.product_name
  LEFT JOIN prev_sales ps ON ps.product_name = pu.product_name
  LEFT JOIN ad_cost_per_product acp ON acp.product_name = pu.product_name
  ORDER BY COALESCE(cs.amount, 0) DESC;
$$;
