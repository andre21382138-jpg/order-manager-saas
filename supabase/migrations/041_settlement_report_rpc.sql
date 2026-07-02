-- Plan 14 Phase 12: 결산조회 표 RPC
-- 상품구분별로 그룹핑한 상품(옵션별) 판매 + 상품구분별 총매출/총광고비.
-- 총광고비는 상품구분에 매칭된 광고그룹의 ad_stats 합계.

DROP FUNCTION IF EXISTS get_settlement_report(uuid, text, date, date);
CREATE FUNCTION get_settlement_report(
  p_brand_id uuid,
  p_mall text,     -- 'all'이면 브랜드 전체
  p_from date,
  p_to date
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  product_no text,
  product_name text,
  option_value text,
  qty bigint,
  amount numeric,
  cat_total_amount numeric,
  cat_total_ad_cost numeric
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH product_lines AS (
    SELECT
      pcm.category_id,
      pc.name AS category_name,
      oi.product_no,
      oi.product_name,
      oi.option_value,
      SUM(oi.qty)::bigint AS qty,
      SUM(oi.amount) AS amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN product_category_mappings pcm
      ON pcm.brand_id = p_brand_id AND pcm.product_no = oi.product_no
    LEFT JOIN product_categories pc ON pc.id = pcm.category_id
    WHERE o.brand_id = p_brand_id
      AND (p_mall = 'all' OR o.mall_type = p_mall)
      AND o.date >= p_from AND o.date <= p_to
      AND o.is_cancelled = false
    GROUP BY pcm.category_id, pc.name, oi.product_no, oi.product_name, oi.option_value
  ),
  category_totals AS (
    SELECT
      category_id,
      SUM(amount) AS total_amount
    FROM product_lines
    GROUP BY category_id
  ),
  category_ad_costs AS (
    SELECT
      agcm.category_id,
      SUM(ast.cost) AS ad_cost
    FROM ad_group_category_mappings agcm
    JOIN ad_units au ON au.brand_id = agcm.brand_id
                     AND au.level = 'keyword'
                     AND (au.metadata->>'ad_group_id') = agcm.ad_group_id
    JOIN ad_stats ast ON ast.ad_unit_id = au.id
                     AND ast.brand_id = p_brand_id
                     AND ast.date >= p_from AND ast.date <= p_to
    WHERE agcm.brand_id = p_brand_id
    GROUP BY agcm.category_id
  )
  SELECT
    pl.category_id,
    COALESCE(pl.category_name, '미분류') AS category_name,
    pl.product_no,
    pl.product_name,
    pl.option_value,
    pl.qty,
    pl.amount,
    COALESCE(ct.total_amount, 0) AS cat_total_amount,
    COALESCE(cac.ad_cost, 0) AS cat_total_ad_cost
  FROM product_lines pl
  LEFT JOIN category_totals ct ON ct.category_id IS NOT DISTINCT FROM pl.category_id
  LEFT JOIN category_ad_costs cac ON cac.category_id = pl.category_id
  ORDER BY
    (pl.category_name IS NULL),           -- 미분류를 마지막에
    pl.category_name,
    pl.product_name,
    pl.option_value NULLS FIRST;
$$;
