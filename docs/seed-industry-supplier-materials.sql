-- 範例：產業供應商材料（測試導入用，可重複執行前請先刪除同名供應商）
-- 圖片使用 placeholder，正式環境請改為實際 URL
-- 供應商登入上架：先執行 add-membership-catalog-visibility.sql，再 docs/bind-industry-supplier-account.sql

INSERT INTO public.industry_suppliers (id, name, description, contact_json, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '示範布料供應商',
    '平台示範用產業供應商（材料、數位原型、配件／零件範例）。',
    '{"phone":"02-0000-0000","email":"demo-supplier@matchdo.app"}'::jsonb,
    true
)
ON CONFLICT (id) DO NOTHING;

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
),
(
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
),
(
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
