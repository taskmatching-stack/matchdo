-- 種子廠商：是否允許綁定帳號經 /api/me/* 自助寫入（平台建置期 ON，交付試用前 OFF）
-- 執行後請重載 PostgREST schema（Supabase 通常自動；若 API 仍缺欄位可重啟或稍候）

ALTER TABLE manufacturers
  ADD COLUMN IF NOT EXISTS seed_vendor_self_service_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN manufacturers.seed_vendor_self_service_enabled IS
  'vendor_source=seed 時：true=綁定帳號可經 /api/me/* 寫入；false=唯讀（交付試用前關閉）。非 seed 廠商忽略此欄。';
