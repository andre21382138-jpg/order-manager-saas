-- Plan 14 Phase 10: 카페24 주문 옵션 정보 저장
-- order_items에 옵션명 컬럼 추가. cafe24 API의 각 item.option_value(옵션 표시명)를 저장.
-- 스마트스토어 주문도 동일하게 사용 가능.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS option_value text;

CREATE INDEX IF NOT EXISTS idx_order_items_option_value
  ON order_items(option_value)
  WHERE option_value IS NOT NULL;
