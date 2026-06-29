-- Plan 4 / Task 2 — pg_cron 6개 잡 (active credentials → sync_jobs INSERT)

-- 카페24 orders 매 30분
SELECT cron.schedule(
  'enqueue_cafe24_orders',
  '*/30 * * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT brand_id, id, channel, 'orders', now()
  FROM brand_credentials
  WHERE channel = 'cafe24' AND status = 'active'
  $$
);

-- 카페24 products 매일 03시
SELECT cron.schedule(
  'enqueue_cafe24_products',
  '0 3 * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT brand_id, id, channel, 'products', now()
  FROM brand_credentials
  WHERE channel = 'cafe24' AND status = 'active'
  $$
);

-- 스마트스토어 orders 매 30분
SELECT cron.schedule(
  'enqueue_smartstore_orders',
  '*/30 * * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT brand_id, id, channel, 'orders', now()
  FROM brand_credentials
  WHERE channel = 'smartstore' AND status = 'active'
  $$
);

-- 네이버광고 ad_stats 매 12시간 (08·20시)
SELECT cron.schedule(
  'enqueue_naver_ad_stats',
  '0 8,20 * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT brand_id, id, channel, 'ad_stats', now()
  FROM brand_credentials
  WHERE channel = 'naver_ad' AND status = 'active'
  $$
);

-- 네이버광고 ad_units 매일 03시
SELECT cron.schedule(
  'enqueue_naver_ad_units',
  '0 3 * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT brand_id, id, channel, 'ad_units', now()
  FROM brand_credentials
  WHERE channel = 'naver_ad' AND status = 'active'
  $$
);

-- token refresh 매 5분 (cafe24 + smartstore만, expires_at 30분 이내)
SELECT cron.schedule(
  'enqueue_token_refresh',
  '*/5 * * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT bc.brand_id, bc.id, bc.channel, 'token_refresh', now()
  FROM brand_credentials bc
  WHERE bc.channel IN ('cafe24', 'smartstore')
    AND bc.status = 'active'
    AND (
      bc.metadata->>'expires_at' IS NULL
      OR (bc.metadata->>'expires_at')::timestamptz < now() + interval '30 minutes'
    )
  $$
);
