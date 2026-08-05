-- 材料雙色卡 Step2 材質生成扣點（payment_config）
-- 執行：Supabase SQL Editor（可選；未寫入時程式預設 10 點）
-- 後台亦可於「會員與點數 → 點數規則」調整

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('points_material_dual_color_flux', '10', now())
ON CONFLICT (key) DO NOTHING;
