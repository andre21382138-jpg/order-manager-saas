-- Plan 1 / Task 4 — brand_credentials
-- 매체×브랜드 자격증명 메타. secret_id는 vault.secrets 참조 (Plan 2에서 실제 연결)

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
