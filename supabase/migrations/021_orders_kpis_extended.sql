-- Plan 10 후속: get_orders_kpis 확장 — 고객 분석용 컬럼 추가
-- 회원구매/비회원구매/회원신규/회원재구매

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
    COALESCE(SUM(CASE WHEN NOT is_cancelled THEN total_amount ELSE 0 END), 0) AS total_revenue,
    COUNT(*) FILTER (WHERE NOT is_cancelled) AS order_count,
    COALESCE(SUM(CASE WHEN is_cancelled THEN total_amount ELSE 0 END), 0) AS refund_amount,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND is_new) AS new_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NOT NULL) AS member_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NULL) AS guest_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NOT NULL AND is_new) AS member_new_count,
    COUNT(*) FILTER (WHERE NOT is_cancelled AND member_id IS NOT NULL AND NOT is_new) AS member_repeat_count
  FROM orders
  WHERE brand_id = p_brand_id
    AND date >= p_from
    AND date <= p_to
    AND (p_mall = 'all' OR mall_type = p_mall);
$$;
