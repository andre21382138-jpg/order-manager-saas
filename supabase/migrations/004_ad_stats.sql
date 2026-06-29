-- Plan 1 / Task 4 — ad_stats
-- 일별 광고 통계 (모든 레벨). ad_unit_id로 ad_units에 연결

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
