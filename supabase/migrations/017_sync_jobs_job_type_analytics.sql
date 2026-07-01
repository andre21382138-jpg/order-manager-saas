-- Plan 10: sync_jobs.job_type CHECK에 'analytics' 추가
-- Plan 1/4 시점 제약이 orders/products/ad_stats/ad_units/token_refresh만 허용해서
-- Plan 10 analytics 잡 enqueue 시 위반. constraint 재정의.

ALTER TABLE sync_jobs DROP CONSTRAINT IF EXISTS sync_jobs_job_type_check;

ALTER TABLE sync_jobs ADD CONSTRAINT sync_jobs_job_type_check
  CHECK (job_type IN ('orders', 'products', 'ad_stats', 'ad_units', 'token_refresh', 'analytics'));
