-- Embed iframe：實境模擬開關（900/1800 方案廠商可設；300 方案後端強制開啟）
-- 執行：Supabase SQL Editor（需已跑 add-embed-simulator-schema.sql）

ALTER TABLE public.manufacturer_embed_instances
ADD COLUMN IF NOT EXISTS scene_sim_enabled boolean DEFAULT true;

COMMENT ON COLUMN public.manufacturer_embed_instances.scene_sim_enabled IS '900/1800 方案可設：embed 訪客是否可使用實境模擬；300 方案後端仍強制開啟';

NOTIFY pgrst, 'reload schema';
