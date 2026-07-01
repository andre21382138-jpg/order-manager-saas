-- Plan 10 성능 fix: orders/order_items 인덱스 추가
-- Postgres가 (brand_id, mall_type, date) 조합 조회를 빠르게

CREATE INDEX IF NOT EXISTS idx_orders_brand_mall_date ON orders(brand_id, mall_type, date);
CREATE INDEX IF NOT EXISTS idx_orders_brand_date ON orders(brand_id, date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
