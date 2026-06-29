-- Plan 1 / Task 5 — brands.owner_id 추가
-- 멀티테넌트 격리 키. 기존 brands는 운영자(ssakwon@kbh.kr) user_id로 일괄 채움.

-- Step 1: 컬럼 추가 (nullable 임시)
ALTER TABLE brands ADD COLUMN owner_id uuid REFERENCES auth.users(id);

-- Step 2: 기존 행 채우기 (운영자 ssakwon@kbh.kr의 auth.users.id)
UPDATE brands
SET owner_id = '4bfab62c-f8b7-4c07-b170-70485e4a6266'::uuid
WHERE owner_id IS NULL;

-- Step 3: NOT NULL 강제
ALTER TABLE brands ALTER COLUMN owner_id SET NOT NULL;

-- Step 4: 인덱스
CREATE INDEX idx_brands_owner ON brands(owner_id);
