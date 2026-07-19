-- 將 AI 放大 2× 基準點數改為 1（每升一階仍由程式 +1）
-- 若後台 payment_config 已有舊值 10／5，不跑此 SQL 則線上仍吃舊數字

INSERT INTO payment_config (key, value, updated_at)
VALUES
  ('points_ai_upscale', '1', NOW()),
  ('points_vendor_asset_upscale', '1', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
