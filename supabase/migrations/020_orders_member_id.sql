-- Plan 10 후속: 고객 분석용 orders.member_id 컬럼 추가
-- 회원구매 vs 비회원구매, 회원 중 신규 vs 재구매 판단

ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_id text NULL;

CREATE INDEX IF NOT EXISTS idx_orders_brand_member ON orders(brand_id, member_id);
