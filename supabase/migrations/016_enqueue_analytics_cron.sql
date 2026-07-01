-- Plan 10: cafe24 analytics (방문자수/유입경로) 매일 03 KST enqueue
SELECT cron.schedule(
  'enqueue_analytics',
  '0 18 * * *',  -- UTC 18 = KST 03:00
  $$
  INSERT INTO sync_jobs (brand_id, credential_id, channel, job_type, scheduled_at)
  SELECT bc.brand_id, bc.id, bc.channel, 'analytics', now()
  FROM brand_credentials bc
  WHERE bc.channel = 'cafe24' AND bc.status = 'active'
  $$
);
