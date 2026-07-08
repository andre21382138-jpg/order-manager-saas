-- get_product_ranking에 p_limit 파라미터 추가 (default 100)
-- 매출조회 상품 판매 순위 표에서 [더보기]로 상위 10개 → 100개까지 확장 가능

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
    AND (p_mall = 'all' OR o.mall_type = p_mall)
  GROUP BY oi.product_name
  ORDER BY SUM(oi.amount) DESC
  LIMIT p_limit;
$$;
