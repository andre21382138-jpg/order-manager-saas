-- Plan 1 / Task 4 — 신규 테이블 6개 일괄 실행용 합본
-- Supabase SQL Editor에 한 번에 붙여넣어 실행 가능
-- 개별 파일은 001~006_*.sql 참조

-- ============================================================
-- 001: brand_credentials
-- ============================================================
CREATE TABLE brand_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL,
  channel_account text NOT NULL,
  secret_id uuid,
  status text NOT NULL DEFAULT 'active',
  last_synced_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, channel, channel_account),
  CHECK (status IN ('active', 'expired', 'error'))
);
CREATE INDEX idx_brand_credentials_brand ON brand_credentials(brand_id);
CREATE INDEX idx_brand_credentials_status ON brand_credentials(status);

-- ============================================================
-- 002: channel_products
-- ============================================================
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

-- ============================================================
-- 003: ad_units (자기참조 FK 때문에 ad_stats보다 먼저)
-- ============================================================
CREATE TABLE ad_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL,
  channel_account text NOT NULL,
  external_id text NOT NULL,
  external_name text,
  level text NOT NULL,
  parent_id uuid REFERENCES ad_units(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, channel, external_id),
  CHECK (level IN ('campaign', 'ad_group', 'keyword', 'creative'))
);
CREATE INDEX idx_ad_units_brand_level ON ad_units(brand_id, level);
CREATE INDEX idx_ad_units_parent ON ad_units(parent_id);

-- ============================================================
-- 004: ad_stats
-- ============================================================
CREATE TABLE ad_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  ad_unit_id uuid REFERENCES ad_units(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  conversion_revenue numeric(14,2) NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_unit_id, date)
);
CREATE INDEX idx_ad_stats_brand_date ON ad_stats(brand_id, date);

-- ============================================================
-- 005: ad_product_mappings
-- ============================================================
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

-- ============================================================
-- 006: sync_jobs
-- ============================================================
CREATE TABLE sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  credential_id uuid REFERENCES brand_credentials(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  date_range_start date,
  date_range_end date,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  error_message text,
  result_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  CHECK (job_type IN ('orders', 'ad_stats', 'products', 'ad_units', 'token_refresh'))
);
CREATE INDEX idx_sync_jobs_pending ON sync_jobs(status, scheduled_at) WHERE status IN ('pending', 'running');
CREATE INDEX idx_sync_jobs_brand ON sync_jobs(brand_id, created_at DESC);

-- ============================================================
-- 검증 쿼리
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'brand_credentials', 'channel_products', 'ad_units',
    'ad_stats', 'ad_product_mappings', 'sync_jobs'
  )
ORDER BY table_name;
-- 기대: 6개 행
