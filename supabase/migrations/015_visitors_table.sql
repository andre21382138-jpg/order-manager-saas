-- Plan 10: cafe24 방문자수 저장 테이블
CREATE TABLE visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  channel_account text NOT NULL,
  mall_type text NOT NULL,
  date date NOT NULL,
  total_visits int NOT NULL DEFAULT 0,
  unique_visits int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, mall_type, date)
);

CREATE INDEX idx_visitors_brand_date ON visitors(brand_id, date);

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY visitors_owner ON visitors
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = visitors.brand_id AND brands.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = visitors.brand_id AND brands.owner_id = auth.uid()
  ));
