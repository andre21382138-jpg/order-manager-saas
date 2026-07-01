-- Plan 11: catalog_products에 사용자 정의 원가 저장 (cafe24 API 미제공 시 직접 입력)
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS cost numeric NULL;
