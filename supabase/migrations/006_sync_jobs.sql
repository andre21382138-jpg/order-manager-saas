-- Plan 1 / Task 4 — sync_jobs
-- 동기화 잡 큐 — pg_cron이 INSERT, 카페24 서버 워커가 폴링·실행 (Plan 3에서 워커 구현)

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
