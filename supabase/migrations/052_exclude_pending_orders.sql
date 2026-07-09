-- PENDING(미결제) 주문을 매출 KPI/일별매출/상품순위에서 제외
-- 카페24 admin의 '일별 매출내역'은 결제완료된 주문만 집계하므로 이에 맞춤.
-- PENDING은 sync-worker가 paid !== 'T' 일 때 부여.

DROP FUNCTION IF EXISTS get_orders_kpis(uuid, text, date, date);

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
  new_count bigint,
  member_count bigint,
  guest_count bigint,
  member_new_count bigint,
  member_repeat_count bigint
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE order_status IS DISTINCT FROM 'PENDING'), 0) AS total_revenue,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND order_status IS DISTINCT FROM 'PENDING') AS order_count,
    COALESCE(SUM(CASE WHEN is_cancelled THEN total_amount ELSE 0 END), 0) AS refund_amount,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND is_new AND order_status IS DISTINCT FROM 'PENDING') AS new_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NOT NULL AND order_status IS DISTINCT FROM 'PENDING') AS member_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NULL AND order_status IS DISTINCT FROM 'PENDING') AS guest_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NOT NULL AND is_new AND order_status IS DISTINCT FROM 'PENDING') AS member_new_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NOT NULL AND NOT is_new AND order_status IS DISTINCT FROM 'PENDING') AS member_repeat_count
  FROM orders
  WHERE brand_id = p_brand_id
    AND date >= p_from
    AND date <= p_to
    AND (p_mall = 'all' OR mall_type = p_mall);
$$;

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
    AND order_status IS DISTINCT FROM 'PENDING'
    AND (p_mall = 'all' OR mall_type = p_mall)
  GROUP BY date
  ORDER BY date;
$$;

CREATE OR REPLACE FUNCTION get_product_ranking(
  p_brand_id uuid,
  p_mall text,
  p_from date,
  p_to date,
  p_limit int DEFAULT 100
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
    AND o.order_status IS DISTINCT FROM 'PENDING'
    AND (p_mall = 'all' OR o.mall_type = p_mall)
  GROUP BY oi.product_name
  ORDER BY SUM(oi.amount) DESC
  LIMIT p_limit;
$$;
