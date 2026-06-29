-- Plan 4 / Task 2 — sync_jobs picking + stale running 회수 RPC

-- pick_pending_job: 한 행 잠금 + 즉시 status='running' + 반환
CREATE OR REPLACE FUNCTION public.pick_pending_job()
RETURNS sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job sync_jobs;
BEGIN
  SELECT * INTO v_job
  FROM sync_jobs
  WHERE status = 'pending'
  ORDER BY scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE sync_jobs
  SET status = 'running',
      started_at = now()
  WHERE id = v_job.id;

  v_job.status := 'running';
  v_job.started_at := now();
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.pick_pending_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pick_pending_job() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pick_pending_job() TO service_role;

-- reset_stale_running: started_at > N분 전인 running 잡을 pending으로 되돌림
CREATE OR REPLACE FUNCTION public.reset_stale_running(threshold_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE sync_jobs
    SET status = 'pending',
        started_at = NULL
    WHERE status = 'running'
      AND started_at < now() - (threshold_minutes || ' minutes')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_stale_running(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stale_running(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_running(int) TO service_role;
