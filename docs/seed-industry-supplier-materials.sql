-- 範例：產業供應商（可重複執行，ON CONFLICT 略過）
-- 前置（依序，若已做過可跳過）：
--   1. docs/add-industry-supplier-catalog.sql
--   2. docs/add-membership-catalog-visibility.sql
--   3. docs/add-supplier-catalog-item-kind-part.sql  ← 要匯入「配件／零件」必跑
--
-- Supabase SQL Editor 若出現 Failed to fetch (api.supabase.com)：
--   - 改「一次只貼一段」執行（下方 STEP 1 → 2 → 3 → 4）
--   - 換網路／關 VPN／換瀏覽器；專案若休眠請先 Restore
--   - 勿一次選取整檔＋其他 migration 一起跑

-- ========== STEP 1：供應商（先跑這段）==========
INSERT INTO public.industry_suppliers (id, name, description, contact_json, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '示範布料供應商',
    '平台示範用產業供應商（材料、數位原型、配件／零件範例）。',
    '{"phone":"02-0000-0000","email":"demo-supplier@matchdo.app"}'::jsonb,
    true
)
ON CONFLICT (id) DO NOTHING;

-- ========== STEP 2：材料（2 筆）==========
INSERT INTO public.supplier_catalog_items (
    id, industry_supplier_id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order
) VALUES
(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'material',
    '棉麻混紡布－霧藍',
    '適合服飾、家飾打樣參考。',
    'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800',
    '{"material_type":"fabric","color":"霧藍","width_cm":150}'::jsonb,
    'apparel',
    true,
    0
),
(
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'material',
    '植鞣牛皮－原色',
    '皮件、配件打樣用。',
    'https://images.unsplash.com/photo-1601925260368-ae2f83b8b118?w=800',
    '{"material_type":"leather","color":"原色"}'::jsonb,
    'bags',
    true,
    1
)
ON CONFLICT (id) DO NOTHING;

-- ========== STEP 3：數位原型（1 筆）==========
INSERT INTO public.supplier_catalog_items (
    id, industry_supplier_id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order
) VALUES (
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    'prototype_set',
    '示範襯衫原型－修身',
    '供製造商匯入為數位原型參考。',
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800',
    '{"style":"shirt","fit":"slim"}'::jsonb,
    'apparel',
    true,
    2
)
ON CONFLICT (id) DO NOTHING;

-- ========== STEP 4：配件／零件（需先跑 add-supplier-catalog-item-kind-part.sql）==========
INSERT INTO public.supplier_catalog_items (
    id, industry_supplier_id, item_kind, title, description, cover_image_url, spec_json, category_key, is_active, sort_order
) VALUES (
    'b0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000001',
    'part',
    '金屬 D 扣－霧銀',
    '箱包、服飾五金配件範例。',
    'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800',
    '{"part_type":"hardware","finish":"matte silver"}'::jsonb,
    'bags',
    true,
    3
)
ON CONFLICT (id) DO NOTHING;

-- 驗證（可選）
-- SELECT item_kind, count(*) FROM supplier_catalog_items
-- WHERE industry_supplier_id = 'a0000000-0000-4000-8000-000000000001'
-- GROUP BY item_kind;
