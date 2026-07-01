-- Plan 10 성능 fix: orders 대량 전체 fetch 대신 Postgres 서버 aggregate RPC.
-- Server Component에서 매 요청마다 pagination loop로 orders 전체 pull하는 대신
-- RPC로 SUM/COUNT/GROUP BY 처리 → 응답 시간 대폭 개선.

-- 1. KPI 조회
CREATE OR REPLACE FUNCTION get_orders_kpis(
  p_brand_id uuid,
  p_mall text,
  p_from date,
  p_to date
)
RETURNS TABLE (
  total_revenue numeric,
  order_count bigint,
  refund_amount numeric,
  new_count bigint
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    COALESCE(SUM(CASE WHEN NOT is_cancelled THEN total_amount ELSE 0 END), 0) AS total_revenue,
    COUNT(*) FILTER (WHERE NOT is_cancelled) AS order_count,
    COALESCE(SUM(CASE WHEN is_cancelled THEN total_amount ELSE 0 END), 0) AS refund_amount,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND is_new) AS new_count
  FROM orders
  WHERE brand_id = p_brand_id
    AND date >= p_from
    AND date <= p_to
    AND (p_mall = 'all' OR mall_type = p_mall);
$$;

-- 2. 일별 매출
CREATE OR REPLACE FUNCTION get_daily_orders(
  p_brand_id uuid,
  p_mall text,
  p_from date,
  p_to date
)
RETURNS TABLE (
  date date,
  revenue numeric,
  order_count bigint
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    date,
    COALESCE(SUM(total_amount), 0) AS revenue,
    COUNT(*) AS order_count
  FROM orders
  WHERE brand_id = p_brand_id
    AND date >= p_from
    AND date <= p_to
    AND is_cancelled = false
    AND (p_mall = 'all' OR mall_type = p_mall)
  GROUP BY date
  ORDER BY date;
$$;

-- 3. 상품 판매 순위 top 10
CREATE OR REPLACE FUNCTION get_product_ranking(
  p_brand_id uuid,
  p_mall text,
  p_from date,
  p_to date
)
RETURNS TABLE (
  product_name text,
  qty bigint,
  amount numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    oi.product_name,
    SUM(oi.qty)::bigint AS qty,
    SUM(oi.amount) AS amount
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.brand_id = p_brand_id
    AND o.date >= p_from
    AND o.date <= p_to
    AND o.is_cancelled = false
    AND (p_mall = 'all' OR o.mall_type = p_mall)
  GROUP BY oi.product_name
  ORDER BY SUM(oi.amount) DESC
  LIMIT 10;
$$;

-- 4. mall list (DISTINCT mall_type)
CREATE OR REPLACE FUNCTION get_mall_list(
  p_brand_id uuid
)
RETURNS TABLE (mall_type text) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT DISTINCT mall_type
  FROM orders
  WHERE brand_id = p_brand_id AND mall_type IS NOT NULL
  ORDER BY mall_type;
$$;

-- RLS는 SECURITY INVOKER라 호출자 권한으로 실행 → orders 테이블의 RLS 정책 자동 적용
