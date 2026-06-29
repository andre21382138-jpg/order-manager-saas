-- Plan 1 / Task 4 — ad_product_mappings
-- 광고 ↔ 채널 상품 수동 매핑 (다대다). 1 광고가 N 상품 광고할 때 weight로 비용 안분

CREATE TABLE ad_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  ad_unit_id uuid REFERENCES ad_units(id) ON DELETE CASCADE NOT NULL,
  channel_product_id uuid REFERENCES channel_products(id) ON DELETE CASCADE NOT NULL,
  weight numeric(5,2) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_unit_id, channel_product_id),
  CHECK (weight > 0)
);

CREATE INDEX idx_ad_product_mappings_brand ON ad_product_mappings(brand_id);
CREATE INDEX idx_ad_product_mappings_ad_unit ON ad_product_mappings(ad_unit_id);
CREATE INDEX idx_ad_product_mappings_product ON ad_product_mappings(channel_product_id);
