-- Plan 14 Phase 9: catalog_products에 channel_account 컬럼 추가
-- 카페24 상품과 스마트스토어 상품이 같은 catalog_products 테이블을 공유하되,
-- 몰별로 격리(같은 product_no 값이 다른 몰에서 다른 상품일 수 있음).

-- 1) 컬럼 추가
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS channel_account text;

-- 2) 브랜드의 cafe24 자격증명을 이용해 backfill (status 조건 없이, 최초 등록된 것 사용)
UPDATE catalog_products cp
SET channel_account = sub.channel_account
FROM (
  SELECT DISTINCT ON (brand_id) brand_id, channel_account
  FROM brand_credentials
  WHERE channel = 'cafe24'
  ORDER BY brand_id, created_at
) sub
WHERE sub.brand_id = cp.brand_id AND cp.channel_account IS NULL;

-- 3) 여전히 NULL인 orphan(cafe24 자격증명 없는 브랜드의 잔존 catalog) 정리
DELETE FROM catalog_products WHERE channel_account IS NULL;

-- 4) NOT NULL 강제
ALTER TABLE catalog_products ALTER COLUMN channel_account SET NOT NULL;

-- 5) 기존 UNIQUE (brand_id, product_no) → 새 UNIQUE (brand_id, channel_account, product_no)
ALTER TABLE catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_brand_id_product_no_key;

ALTER TABLE catalog_products
  ADD CONSTRAINT catalog_products_brand_channel_product_no_key
    UNIQUE (brand_id, channel_account, product_no);

-- 6) 조회 인덱스 (몰별 상품 리스트용)
CREATE INDEX IF NOT EXISTS idx_catalog_brand_channel
  ON catalog_products(brand_id, channel_account);
