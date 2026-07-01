-- Plan 13: get_product_sales 재작성 (category GROUP BY, 미분류 fallback, ad_cost per category)

DROP FUNCTION IF EXISTS get_product_sales(uuid, text, date, date, date, date);
CREATE FUNCTION get_product_sales(
  p_brand_id uuid,
  p_mall text,
  p_from date, p_to date,
  p_prev_from date, p_prev_to date
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  qty bigint,
  amount numeric,
  prev_amount numeric,
  cost_total numeric,
  ad_cost numeric,
  product_count integer
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH is_cafe24_mall AS (
    SELECT EXISTS (
      SELECT 1 FROM brand_credentials bc
      WHERE bc.brand_id = p_brand_id
        AND bc.channel = 'cafe24'
        AND bc.channel_account = p_mall
    ) AS ok
  ),
  current_items AS (
    SELECT oi.product_name, oi.qty, oi.amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND o.date >= p_from AND o.date <= p_to
      AND o.is_cancelled = false
  ),
  prev_items AS (
    SELECT oi.product_name, oi.amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND o.date >= p_prev_from AND o.date <= p_prev_to
      AND o.is_cancelled = false
  ),
  mapping AS (
    SELECT m.product_name, m.category_id, pc.name AS category_name
    FROM product_category_mappings m
    JOIN product_categories pc ON pc.id = m.category_id
    WHERE m.brand_id = p_brand_id
  ),
  cost_by_name AS (
    SELECT cp.product_name, cp.cost
    FROM catalog_products cp, is_cafe24_mall
    WHERE cp.brand_id = p_brand_id
      AND is_cafe24_mall.ok
      AND cp.cost IS NOT NULL
  ),
  current_grouped AS (
    SELECT
      m.category_id,
      COALESCE(m.category_name, '미분류') AS category_name,
      SUM(ci.qty)::bigint AS qty,
      SUM(ci.amount) AS amount,
      COALESCE(SUM(cn.cost * ci.qty), 0) AS cost_total,
      COUNT(DISTINCT ci.product_name)::integer AS product_count
    FROM current_items ci
    LEFT JOIN mapping m ON m.product_name = ci.product_name
    LEFT JOIN cost_by_name cn ON cn.product_name = ci.product_name
    GROUP BY m.category_id, COALESCE(m.category_name, '미분류')
  ),
  prev_grouped AS (
    SELECT
      m.category_id,
      COALESCE(m.category_name, '미분류') AS category_name,
      SUM(pi.amount) AS prev_amount
    FROM prev_items pi
    LEFT JOIN mapping m ON m.product_name = pi.product_name
    GROUP BY m.category_id, COALESCE(m.category_name, '미분류')
  ),
  ad_by_category AS (
    SELECT
      cpm.category_id,
      SUM(ast.cost) AS ad_cost
    FROM campaign_product_mappings cpm
    JOIN ad_stats ast ON ast.ad_unit_id = cpm.ad_unit_id
    WHERE cpm.brand_id = p_brand_id
      AND ast.brand_id = p_brand_id
      AND ast.date >= p_from AND ast.date <= p_to
    GROUP BY cpm.category_id
  )
  SELECT
    cg.category_id,
    cg.category_name,
    cg.qty,
    cg.amount,
    COALESCE(pg.prev_amount, 0) AS prev_amount,
    cg.cost_total,
    COALESCE(ac.ad_cost, 0) AS ad_cost,
    cg.product_count
  FROM current_grouped cg
  LEFT JOIN prev_grouped pg
    ON pg.category_id IS NOT DISTINCT FROM cg.category_id
    AND pg.category_name = cg.category_name
  LEFT JOIN ad_by_category ac ON ac.category_id = cg.category_id
  ORDER BY cg.amount DESC;
$$;
