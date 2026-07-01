-- Plan 13: campaign_product_mappings 재설계 (product_name → category_id)
-- Plan 12에서 만든 테이블이 이미 있다면 DROP 후 재생성

DROP TABLE IF EXISTS campaign_product_mappings;

CREATE TABLE campaign_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  ad_unit_id uuid NOT NULL REFERENCES ad_units(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, ad_unit_id, category_id)
);

CREATE INDEX idx_cpm_ad_unit ON campaign_product_mappings(ad_unit_id);
CREATE INDEX idx_cpm_category ON campaign_product_mappings(category_id);

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
