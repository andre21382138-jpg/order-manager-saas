-- Plan 1 / Task 4 — ad_units
-- 광고 단위 통합 (campaign / ad_group / keyword / creative)
-- 모든 매체×모든 레벨이 이 한 테이블에 적재됨

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
