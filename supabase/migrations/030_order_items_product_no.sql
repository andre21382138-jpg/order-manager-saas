-- Plan 14: order_items에 상품코드(product_no) 컬럼 추가
-- cafe24/smartstore order items API가 반환하는 productId를 지금까지 버려왔음.
-- 상품구분(카테고리) 매칭을 상품코드 기반으로 전환하기 위해 저장.
-- 과거 데이터는 sync-worker 재sync 잡으로 backfill.

ALTER TABLE order_items ADD COLUMN product_no text NULL;

CREATE INDEX idx_order_items_product_no
  ON order_items(product_no)
  WHERE product_no IS NOT NULL;
