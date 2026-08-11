-- 商攝參數：依攝影主題（product / space / portrait）設定預設值
-- 將既有 is_default=true 同步至 meta.default_for_modes（產品攝影）

UPDATE promo_camera_param_options
SET meta = jsonb_set(
    COALESCE(meta, '{}'::jsonb),
    '{default_for_modes}',
    '["product"]'::jsonb,
    true
)
WHERE is_default = true
  AND (meta IS NULL OR NOT (meta ? 'default_for_modes'));
