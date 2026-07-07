-- Plan 14 Phase 13 hotfix: visitors 테이블 RLS 정책도 다중 회원 지원
-- 048에서 누락된 visitors 정책을 user_has_brand_access로 재작성.

BEGIN;

DROP POLICY IF EXISTS visitors_owner ON visitors;
DROP POLICY IF EXISTS visitors_access ON visitors;

CREATE POLICY visitors_access ON visitors
  FOR ALL
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));

COMMIT;
