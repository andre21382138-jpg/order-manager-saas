-- Plan 1 / Task 4 — channel_products
-- 매체별 상품 그대로 저장. alias로 통합 표시명 지정 가능

CREATE TABLE channel_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL,
  channel_account text NOT NULL,
  external_product_id text NOT NULL,
  external_product_name text,
  thumbnail_url text,
  alias text,
  metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, channel, channel_account, external_product_id)
);

CREATE INDEX idx_channel_products_brand ON channel_products(brand_id);
CREATE INDEX idx_channel_products_alias ON channel_products(brand_id, alias) WHERE alias IS NOT NULL;
CREATE INDEX idx_channel_products_name_search ON channel_products
  USING gin (to_tsvector('simple', coalesce(external_product_name, '') || ' ' || coalesce(alias, '')));
