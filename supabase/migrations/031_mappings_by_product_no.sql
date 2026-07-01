-- Plan 14: product_category_mappings 재설계 (상품명 → 상품코드 키 전환)
-- 기존은 (brand_id, product_name) UNIQUE. 이번엔 (brand_id, product_no) UNIQUE로 변경.
-- Excel Import를 재실행하여 매핑을 다시 채우므로 기존 데이터는 폐기.
-- product_category_mappings를 참조하는 campaign_product_mappings는
-- product_categories CASCADE 삭제 시 함께 정리됨 (Excel 재 import 시 초기화).

DROP TABLE IF EXISTS product_category_mappings;

CREATE TABLE product_category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  product_no text NOT NULL,
  product_name text NULL,           -- 참조용 (엑셀 원본 상품명 기록, 조회에 사용 안 함)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, product_no)
);

CREATE INDEX idx_pcm_brand_product_no ON product_category_mappings(brand_id, product_no);
CREATE INDEX idx_pcm_category ON product_category_mappings(category_id);

ALTER TABLE product_category_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcm_owner ON product_category_mappings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = product_category_mappings.brand_id AND brands.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = product_category_mappings.brand_id AND brands.owner_id = auth.uid()
  ));
