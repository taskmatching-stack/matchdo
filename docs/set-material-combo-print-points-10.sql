-- 材料組合／印花：預設點數改為 10
-- Supabase SQL Editor 執行一次（會覆寫這兩個 key 的現值）
-- 之後仍可於 /admin/membership.html → 點數規則 調整

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
    ('points_material_dual_color_flux', '10', now()),
    ('points_print_asset_flux', '10', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
