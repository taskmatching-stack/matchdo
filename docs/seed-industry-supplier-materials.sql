-- 範例：產業供應商材料（測試導入用，可重複執行前請先刪除同名供應商）
-- 圖片使用 placeholder，正式環境請改為實際 URL

INSERT INTO public.industry_suppliers (id, name, description, contact_json, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '示範布料供應商',
    '平台示範用產業供應商，供製造商測試「導入材料」。',
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
)
ON CONFLICT (id) DO NOTHING;
