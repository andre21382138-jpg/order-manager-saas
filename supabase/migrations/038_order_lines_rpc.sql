-- Plan 14 Phase 10: 주문 라인 리스트 조회 RPC
-- 매출조회 페이지 '주문조회' 탭용. product_category_mappings로 상품구분 join.

CREATE OR REPLACE FUNCTION get_order_lines(
  p_brand_id uuid,
  p_mall text,     -- 'all'이면 브랜드 전체
  p_from date,
  p_to date
)
RETURNS TABLE (
  order_date date,
  order_no text,
  mall_type text,
  category_name text,
  product_no text,
  product_name text,
  option_value text,
  qty bigint,
  amount numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    o.date AS order_date,
    o.order_no,
    o.mall_type,
    COALESCE(pc.name, '미분류') AS category_name,
    oi.product_no,
    oi.product_name,
    oi.option_value,
    oi.qty::bigint,
    oi.amount
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  LEFT JOIN product_category_mappings m
    ON m.brand_id = o.brand_id AND m.product_no = oi.product_no
  LEFT JOIN product_categories pc ON pc.id = m.category_id
  WHERE o.brand_id = p_brand_id
    AND (p_mall = 'all' OR o.mall_type = p_mall)
    AND o.date >= p_from AND o.date <= p_to
    AND o.is_cancelled = false
  ORDER BY o.date DESC, o.order_no DESC;
$$;
