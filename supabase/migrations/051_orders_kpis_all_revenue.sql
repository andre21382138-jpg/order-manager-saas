-- get_orders_kpis: total_revenue를 취소 포함 전체 결제합계로 변경 (카페24 admin의 '결제합계' 정의)
-- 최종매출 = total_revenue(전체 결제합계) - refund_amount(환불합계) = 카페24의 순매출

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
    -- 결제합계: 전체 주문의 total_amount 합 (취소·환불 포함)
    COALESCE(SUM(total_amount), 0) AS total_revenue,
    -- 주문 건수: 활성 주문만 (환불 제외)
    COUNT(*) FILTER (WHERE NOT is_cancelled) AS order_count,
    -- 환불합계: 취소 주문의 total_amount 합
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
