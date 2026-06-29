-- Plan 1 / Task 6 — RLS 정책 재배포
-- 기존 authenticated_read/authenticated_write (qual=true) 정책을
-- owner_id 기반 멀티테넌트 정책으로 전환.
-- BEGIN/COMMIT으로 감싸 DROP/CREATE 사이 갭을 0초로 만듦.

BEGIN;

-- ============================================================
-- Step 1: RLS 활성화 (이미 켜져 있어도 idempotent)
-- ============================================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE naver_ad_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 2: 기존 정책 모두 DROP
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'brands','orders','order_items','product_category_map',
        'catalog_products','naver_ad_stats','brand_credentials',
        'channel_products','ad_units','ad_stats',
        'ad_product_mappings','sync_jobs'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- Step 3: brands — 본인 소유만
-- ============================================================
CREATE POLICY brands_owner ON brands
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- Step 4: 자식 테이블 — brand_id로 owner 검증
-- ============================================================

-- orders
CREATE POLICY orders_owner ON orders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = orders.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = orders.brand_id AND brands.owner_id = auth.uid()));

-- order_items
CREATE POLICY order_items_owner ON order_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders
    JOIN brands ON brands.id = orders.brand_id
    WHERE orders.id = order_items.order_id AND brands.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders
    JOIN brands ON brands.id = orders.brand_id
    WHERE orders.id = order_items.order_id AND brands.owner_id = auth.uid()
  ));

-- product_category_map
CREATE POLICY product_category_map_owner ON product_category_map
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = product_category_map.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = product_category_map.brand_id AND brands.owner_id = auth.uid()));

-- catalog_products
CREATE POLICY catalog_products_owner ON catalog_products
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = catalog_products.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = catalog_products.brand_id AND brands.owner_id = auth.uid()));

-- naver_ad_stats
CREATE POLICY naver_ad_stats_owner ON naver_ad_stats
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = naver_ad_stats.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = naver_ad_stats.brand_id AND brands.owner_id = auth.uid()));

-- brand_credentials
CREATE POLICY brand_credentials_owner ON brand_credentials
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_credentials.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_credentials.brand_id AND brands.owner_id = auth.uid()));

-- channel_products
CREATE POLICY channel_products_owner ON channel_products
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = channel_products.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = channel_products.brand_id AND brands.owner_id = auth.uid()));

-- ad_units
CREATE POLICY ad_units_owner ON ad_units
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = ad_units.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = ad_units.brand_id AND brands.owner_id = auth.uid()));

-- ad_stats
CREATE POLICY ad_stats_owner ON ad_stats
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = ad_stats.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = ad_stats.brand_id AND brands.owner_id = auth.uid()));

-- ad_product_mappings
CREATE POLICY ad_product_mappings_owner ON ad_product_mappings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = ad_product_mappings.brand_id AND brands.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = ad_product_mappings.brand_id AND brands.owner_id = auth.uid()));

-- sync_jobs (사용자는 자기 brands의 잡만 SELECT 가능. INSERT/UPDATE는 service_role/pg_cron)
CREATE POLICY sync_jobs_owner_select ON sync_jobs
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = sync_jobs.brand_id AND brands.owner_id = auth.uid()));

COMMIT;
