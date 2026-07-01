-- Plan 13: 상품구분(카테고리) + 매핑 테이블

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, name)
);

CREATE INDEX idx_pc_brand ON product_categories(brand_id);

CREATE TABLE product_category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  product_no text NULL,
  product_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, product_name)
);

CREATE INDEX idx_pcm_brand_name ON product_category_mappings(brand_id, product_name);
CREATE INDEX idx_pcm_category ON product_category_mappings(category_id);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_owner ON product_categories
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = product_categories.brand_id AND brands.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = product_categories.brand_id AND brands.owner_id = auth.uid()
  ));

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
