-- 攝影模擬：區分 App / 網站（及設計頁 embed）入口
ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS client_channel TEXT NOT NULL DEFAULT 'web';

COMMENT ON COLUMN public.product_promo_generations.client_channel IS 'promo 生圖入口：web=網站 /promo-camera；app=獨立 App /promo-camera-app；embed=設計頁嵌入';

-- 既有 camera_advanced 列預設 web（無法事後區分 App）
UPDATE public.product_promo_generations
SET client_channel = 'web'
WHERE client_channel IS NULL OR client_channel = '';

CREATE INDEX IF NOT EXISTS idx_promo_gen_client_channel
    ON public.product_promo_generations (client_channel, created_at DESC)
    WHERE generation_mode = 'camera_advanced';
