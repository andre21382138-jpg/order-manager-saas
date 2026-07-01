-- Plan 11 hotfix: get_product_info/sales의 '자사몰' 하드코딩 → brand_credentials.channel='cafe24' 매칭
-- 사용자가 mall 별칭을 '팔레오 자사몰'로 변경한 경우도 catalog_products 인식하도록

DROP FUNCTION IF EXISTS get_product_info(uuid, text);
CREATE FUNCTION get_product_info(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  catalog_product_id uuid,
  product_name text,
  price numeric,
  cost numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH cafe24_products AS (
    -- p_mall이 이 브랜드의 cafe24 자격증명 별칭이면 catalog_products 표시
    SELECT cp.id, cp.product_name, cp.price, cp.cost
    FROM catalog_products cp
    WHERE cp.brand_id = p_brand_id
      AND EXISTS (
        SELECT 1 FROM brand_credentials bc
        WHERE bc.brand_id = p_brand_id
          AND bc.channel = 'cafe24'
          AND bc.channel_account = p_mall
      )
  ),
  order_derived AS (
    SELECT DISTINCT oi.product_name
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND oi.product_name IS NOT NULL AND oi.product_name != ''
  )
  SELECT cp.id, cp.product_name, cp.price, cp.cost FROM cafe24_products cp
  UNION ALL
  SELECT NULL::uuid, od.product_name, NULL::numeric, NULL::numeric
  FROM order_derived od
  WHERE NOT EXISTS (SELECT 1 FROM cafe24_products cp2 WHERE cp2.product_name = od.product_name)
  ORDER BY product_name;
$$;

DROP FUNCTION IF EXISTS get_product_sales(uuid, text, date, date, date, date);
CREATE FUNCTION get_product_sales(
  p_brand_id uuid, p_mall text,
  p_from date, p_to date,
  p_prev_from date, p_prev_to date
)
RETURNS TABLE (
  product_name text, current_qty bigint,
  current_amount numeric, prev_amount numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH product_universe AS (
    SELECT cp.product_name FROM catalog_products cp
    WHERE cp.brand_id = p_brand_id
      AND EXISTS (
        SELECT 1 FROM brand_credentials bc
        WHERE bc.brand_id = p_brand_id
          AND bc.channel = 'cafe24'
          AND bc.channel_account = p_mall
      )
    UNION
    SELECT DISTINCT oi.product_name FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id AND o.mall_type = p_mall
      AND oi.product_name IS NOT NULL AND oi.product_name != ''
  ),
  current_sales AS (
    SELECT oi.product_name, SUM(oi.qty)::bigint qty, SUM(oi.amount) amount
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id AND o.mall_type = p_mall
      AND o.date >= p_from AND o.date <= p_to AND o.is_cancelled = false
    GROUP BY oi.product_name
  ),
  prev_sales AS (
    SELECT oi.product_name, SUM(oi.amount) amount
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id AND o.mall_type = p_mall
      AND o.date >= p_prev_from AND o.date <= p_prev_to AND o.is_cancelled = false
    GROUP BY oi.product_name
  )
  SELECT pu.product_name,
    COALESCE(cs.qty, 0), COALESCE(cs.amount, 0), COALESCE(ps.amount, 0)
  FROM product_universe pu
  LEFT JOIN current_sales cs ON cs.product_name = pu.product_name
  LEFT JOIN prev_sales ps ON ps.product_name = pu.product_name
  ORDER BY COALESCE(cs.amount, 0) DESC;
$$;
