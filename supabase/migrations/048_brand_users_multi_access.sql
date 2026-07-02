-- Plan 14 Phase 13: 브랜드 다중 접근 회원 지원
-- brand_users(brand_id, user_id, role) 신설.
-- 접근 판정 함수 user_has_brand_access(brand_id) 정의.
-- 모든 RLS 정책을 이 함수 기반으로 재설정 (owner 또는 brand_users 멤버).

BEGIN;

-- 1) brand_users 테이블
CREATE TABLE IF NOT EXISTS brand_users (
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_users_user ON brand_users(user_id);

ALTER TABLE brand_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_users_self_read ON brand_users;
CREATE POLICY brand_users_self_read ON brand_users
  FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM brands WHERE brands.id = brand_users.brand_id AND brands.owner_id = auth.uid()
  ));

-- 2) 접근 판정 헬퍼 함수 (owner 또는 멤버)
CREATE OR REPLACE FUNCTION public.user_has_brand_access(p_brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM brands WHERE id = p_brand_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM brand_users WHERE brand_id = p_brand_id AND user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.user_has_brand_access(uuid) TO authenticated;

-- 3) 기존 정책 삭제 + 재생성 (헬퍼 사용)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'brands','orders','order_items',
        'catalog_products','brand_credentials','channel_products',
        'ad_units','ad_stats','sync_jobs',
        'product_categories','product_category_mappings',
        'campaign_product_mappings','ad_group_category_mappings'
      )
      AND policyname NOT LIKE '%_self_read'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- brands: 소유자 또는 멤버 read/all; write는 owner만
CREATE POLICY brands_access ON brands
  FOR SELECT
  USING (public.user_has_brand_access(id));
CREATE POLICY brands_write ON brands
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 하위 테이블
CREATE POLICY orders_access ON orders
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY order_items_access ON order_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id
      AND public.user_has_brand_access(orders.brand_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id
      AND public.user_has_brand_access(orders.brand_id)
  ));

CREATE POLICY catalog_products_access ON catalog_products
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY brand_credentials_access ON brand_credentials
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY channel_products_access ON channel_products
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY ad_units_access ON ad_units
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY ad_stats_access ON ad_stats
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY sync_jobs_access ON sync_jobs
  FOR SELECT
  USING (public.user_has_brand_access(brand_id));

CREATE POLICY product_categories_access ON product_categories
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY product_category_mappings_access ON product_category_mappings
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY campaign_product_mappings_access ON campaign_product_mappings
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

CREATE POLICY ad_group_category_mappings_access ON ad_group_category_mappings
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

COMMIT;
