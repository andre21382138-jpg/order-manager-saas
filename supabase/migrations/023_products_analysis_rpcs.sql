-- Plan 11: 상품 분석 RPC 3종

-- 1. 상품 mall list (orders.mall_type DISTINCT)
DROP FUNCTION IF EXISTS get_product_mall_list(uuid);
CREATE FUNCTION get_product_mall_list(p_brand_id uuid)
RETURNS TABLE (mall_type text) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT DISTINCT mall_type
  FROM orders
  WHERE brand_id = p_brand_id AND mall_type IS NOT NULL
  ORDER BY mall_type;
$$;

-- 2. 상품정보 (자사몰이면 catalog_products + order_items 파생 UNION, 스마트스토어는 order_items DISTINCT)
DROP FUNCTION IF EXISTS get_product_info(uuid, text);
CREATE FUNCTION get_product_info(p_brand_id uuid, p_mall text)
RETURNS TABLE (
  catalog_product_id uuid,
  product_name text,
  price numeric,
  cost numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH cafe24_products AS (
    -- 자사몰 탭에만 catalog_products 표시. 스마트스토어면 빈 집합
    SELECT cp.id, cp.product_name, cp.price, cp.cost
    FROM catalog_products cp
    WHERE cp.brand_id = p_brand_id
      AND p_mall = '자사몰'
  ),
  order_derived AS (
    -- order_items에서 파생된 상품명 (catalog_products에 없는 것도 포함)
    SELECT DISTINCT oi.product_name
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.brand_id = p_brand_id
      AND o.mall_type = p_mall
      AND oi.product_name IS NOT NULL
      AND oi.product_name != ''
  )
  SELECT
    cp.id AS catalog_product_id,
    cp.product_name,
    cp.price,
    cp.cost
  FROM cafe24_products cp
  UNION ALL
  SELECT
    NULL::uuid AS catalog_product_id,
    od.product_name,
    NULL::numeric AS price,
    NULL::numeric AS cost
  FROM order_derived od
  WHERE NOT EXISTS (SELECT 1 FROM cafe24_products cp2 WHERE cp2.product_name = od.product_name)
  ORDER BY product_name;
$$;

-- 3. 판매 데이터 (현재 기간 + 전월 동기간) — 판매 없는 상품도 포함
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
  prev_amount numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH product_universe AS (
    -- 자사몰: catalog_products + order_items UNION. 스마트스토어: order_items만
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
  )
  SELECT
    pu.product_name,
    COALESCE(cs.qty, 0) AS current_qty,
    COALESCE(cs.amount, 0) AS current_amount,
    COALESCE(ps.amount, 0) AS prev_amount
  FROM product_universe pu
  LEFT JOIN current_sales cs ON cs.product_name = pu.product_name
  LEFT JOIN prev_sales ps ON ps.product_name = pu.product_name
  ORDER BY COALESCE(cs.amount, 0) DESC;
$$;
