-- Plan 12: 캠페인-상품 매핑 테이블
CREATE TABLE campaign_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  ad_unit_id uuid NOT NULL REFERENCES ad_units(id) ON DELETE CASCADE,
  mall_type text NOT NULL,
  product_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, ad_unit_id, mall_type, product_name)
);

CREATE INDEX idx_cpm_brand_mall ON campaign_product_mappings(brand_id, mall_type);
CREATE INDEX idx_cpm_product ON campaign_product_mappings(brand_id, mall_type, product_name);
CREATE INDEX idx_cpm_ad_unit ON campaign_product_mappings(ad_unit_id);

ALTER TABLE campaign_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpm_owner ON campaign_product_mappings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = campaign_product_mappings.brand_id AND brands.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = campaign_product_mappings.brand_id AND brands.owner_id = auth.uid()
  ));
