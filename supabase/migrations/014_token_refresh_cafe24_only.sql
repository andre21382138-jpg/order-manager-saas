-- Plan 7a: smartstore는 client_credentials grant라 token_refresh 불필요
-- enqueue_token_refresh를 cafe24 전용으로 좁힘 (이전 011은 cafe24/smartstore 둘 다)
SELECT cron.unschedule('enqueue_token_refresh');

SELECT cron.schedule(
  'enqueue_token_refresh',
  '*/5 * * * *',
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT bc.brand_id, bc.id, bc.channel, 'token_refresh', now()
  FROM brand_credentials bc
  WHERE bc.channel = 'cafe24'
    AND bc.status = 'active'
    AND (
      bc.metadata->>'expires_at' IS NULL
      OR (bc.metadata->>'expires_at')::timestamptz < now() + interval '30 minutes'
    )
  $$
);
